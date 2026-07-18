// Bundles apps/iam/public/** (source) into apps/iam/dist/public/** (served, at
// /<prefix>/assets/, via publicDir in apps/iam/src/main.ts). Mirrors the
// EJS-page convention documented in .claude/skills/init-view/SKILL.md.
//
// Usage:
//   node apps/iam/build-assets.mjs            bundle once (minified unless NODE_ENV=local)
//   node apps/iam/build-assets.mjs --watch     bundle once, then rebuild on file change
import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { copyFile, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import * as esbuild from 'esbuild';

const APP_ROOT = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(APP_ROOT, 'public');
const OUT_DIR = join(APP_ROOT, 'dist', 'public');
const isWatch = process.argv.includes('--watch');
const isLocal = process.env.NODE_ENV === 'local';

/**
 * Every admin-shell page (dashboard/users/roles/policies/audit-logs/sessions/
 * system-setting) shares one stylesheet — the `user-management` directory name
 * is legacy (that used to be the single monolithic page) but now doubles as the
 * shared JS/CSS library location the per-page controllers import from, so the
 * css `entry` below intentionally points there for every page.
 */
const ADMIN_SHELL_CSS_ENTRY = join(SRC_DIR, 'pages/user-management/css/user-management.css');

function adminShellPage(name) {
  return {
    name,
    js: {
      entry: join(SRC_DIR, `pages/${name}/js/entry.js`),
      out: join(OUT_DIR, `pages/${name}/js/bundle.js`),
    },
    css: {
      entry: ADMIN_SHELL_CSS_ENTRY,
      out: join(OUT_DIR, `pages/${name}/css/bundle.css`),
    },
  };
}

/** One entry per page under public/pages/{name}/. Set css:null if a page has no page-specific styles. */
const PAGES = [
  adminShellPage('dashboard'),
  adminShellPage('users'),
  adminShellPage('roles'),
  adminShellPage('policies'),
  adminShellPage('audit-logs'),
  adminShellPage('sessions'),
  adminShellPage('system-setting'),
];

/** Shared static files copied as-is (no bundling — plain CSS, no @import graph). */
const SHARED_CSS = ['css/global.css', 'css/auth-modal.css'];

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function copySharedCss() {
  for (const relPath of SHARED_CSS) {
    const from = join(SRC_DIR, relPath);
    const to = join(OUT_DIR, relPath);
    if (!existsSync(from)) continue;
    await ensureDir(to);
    await copyFile(from, to);
  }
}

function jsBuildOptions({ entry, out }) {
  return {
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    format: 'iife',
    minify: !isLocal,
    sourcemap: isLocal,
    target: ['es2020'],
    logLevel: 'info',
  };
}

function cssBuildOptions({ entry, out }) {
  return {
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    minify: !isLocal,
    sourcemap: isLocal,
    logLevel: 'info',
  };
}

/** SHA1 over every output file's contents — cache-busting `?v=` for <link>/<script> tags. */
function computeVersion(dir) {
  const hash = createHash('sha1');
  const walk = (current) => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (!entry.endsWith('.map')) {
        hash.update(readFileSync(full));
      }
    }
  };
  if (existsSync(dir)) walk(dir);
  return hash.digest('hex').slice(0, 12);
}

async function writeManifest() {
  const version = computeVersion(OUT_DIR);
  await ensureDir(join(OUT_DIR, 'build-manifest.json'));
  await writeFile(
    join(OUT_DIR, 'build-manifest.json'),
    JSON.stringify({ version, builtAt: new Date().toISOString() }, null, 2),
  );
  return version;
}

async function buildOnce() {
  for (const page of PAGES) {
    if (page.js) {
      await ensureDir(page.js.out);
      await esbuild.build(jsBuildOptions(page.js));
    }
    if (page.css) {
      await ensureDir(page.css.out);
      await esbuild.build(cssBuildOptions(page.css));
    }
  }
  await copySharedCss();
  const version = await writeManifest();
  console.log(`[iam:build-assets] done — version ${version}`);
}

async function watch() {
  const contexts = [];
  for (const page of PAGES) {
    if (page.js) {
      await ensureDir(page.js.out);
      contexts.push(await esbuild.context(jsBuildOptions(page.js)));
    }
    if (page.css) {
      await ensureDir(page.css.out);
      contexts.push(await esbuild.context(cssBuildOptions(page.css)));
    }
  }
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  await copySharedCss();
  await writeManifest();
  console.log('[iam:build-assets] watching for changes...');

  // Shared css files aren't part of esbuild's watch graph (copied, not bundled) —
  // poll them separately so global.css edits show up without a manual re-run.
  // Errors here (e.g. a transient ENOSPC) are logged, not thrown — this is a
  // background convenience poll and must not take the whole watcher down.
  setInterval(() => {
    Promise.all([copySharedCss(), writeManifest()]).catch((error) => {
      console.error('[iam:build-assets] shared-css poll failed:', error.message);
    });
  }, 2000);
}

if (isWatch) {
  await watch();
} else {
  await buildOnce();
}
