import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import {
  IUiPermissionsManifest,
  UI_PERMISSIONS_MANIFEST_FILENAME,
} from './ui-permissions-manifest.schema';

/**
 * Pure (no DB, no side effects) source-scanning half of `permissions:sync` —
 * extracted so both the CLI script (`sync-permissions.script.ts`) and the
 * in-app "Sync Permissions" button (`apps/iam` `PermissionsSyncService`) scan
 * the exact same way instead of drifting apart.
 *
 * `APPS_ROOT` is anchored to `process.cwd()`, not `__dirname` — every entry
 * point that imports this file (the CLI script via `ts-node`, and every Nest
 * app, which builds with `webpack: true` per `nest-cli.json`) is always
 * launched from the monorepo root, but only `ts-node` preserves this file's
 * real on-disk path for `__dirname` to be meaningful. Once webpack bundles
 * this code into `apps/<service>`'s single `main.js`, `__dirname` resolves to
 * that bundle's own directory instead — `join(__dirname, '../../../../apps')`
 * silently pointed outside the repo, so `readdirSync` threw the moment
 * `PermissionsSyncService.runSync()` called these scan functions from a
 * running (webpacked) app, even though the identical CLI script worked fine.
 */

const APPS_ROOT = join(process.cwd(), 'apps');
const DECORATOR_CALL_START = '@RequirePermission(';
/**
 * Matches any quoted `page:*` / `component:*` string in a views/public file —
 * not only inside a literal `data-permission="..."` attribute, since some
 * pages build the attribute value from a JS template (e.g. dashboard widgets
 * assign `permission: 'component:widget_total_users'` in an object literal,
 * then interpolate `data-permission="${s.permission}"`). Scoped to the
 * `page:`/`component:` prefix convention so it can't accidentally pick up an
 * api-plane permission string reused client-side for hiding a button (e.g.
 * `hasPermission('role:create')`), which would otherwise get miscounted as a
 * new ui-plane row.
 */
const UI_PERMISSION_LITERAL = /(['"])((?:page|component):[a-zA-Z0-9_]+)\1/g;

export interface IScannedPermission {
  service: string;
  permission: string;
  resource: string;
  action: string;
  name: { th: string; en: string } | undefined;
  plane: 'api' | 'ui';
}

function walk(
  dir: string,
  matches: (entry: string) => boolean,
  files: string[] = [],
): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, matches, files);
    } else if (matches(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

const isSourceFile = (entry: string): boolean =>
  entry.endsWith('.ts') && !entry.endsWith('.spec.ts');
const isViewFile = (entry: string): boolean =>
  entry.endsWith('.ejs') || entry.endsWith('.js');

/** Extracts the raw `(...)` argument text of a call starting at `openParenIndex`, respecting nested parens/braces and quoted strings. */
function extractBalancedArgs(content: string, openParenIndex: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openParenIndex; i < content.length; i++) {
    const char = content[i];
    if (quote) {
      if (char === quote && content[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) return content.slice(openParenIndex + 1, i);
    }
  }
  return content.slice(openParenIndex + 1);
}

function parseDecoratorCall(
  args: string,
): { permission: string; name: { th: string; en: string } | undefined } | null {
  const permissionMatch = /^\s*(['"])([a-zA-Z0-9_]+:[a-zA-Z0-9_]+)\1/.exec(
    args,
  );
  if (!permissionMatch) return null;

  const remainder = args.slice(permissionMatch[0].length);
  const thMatch = /\bth\s*:\s*(['"])((?:(?!\1).)*)\1/.exec(remainder);
  const enMatch = /\ben\s*:\s*(['"])((?:(?!\1).)*)\1/.exec(remainder);
  const name =
    thMatch && enMatch ? { th: thMatch[2], en: enMatch[2] } : undefined;

  return { permission: permissionMatch[2], name };
}

export function scanApiPermissions(): IScannedPermission[] {
  const found = new Map<string, IScannedPermission>();

  for (const service of readdirSync(APPS_ROOT)) {
    const srcDir = join(APPS_ROOT, service, 'src');
    try {
      if (!statSync(srcDir).isDirectory()) continue;
    } catch {
      continue;
    }

    for (const file of walk(srcDir, isSourceFile)) {
      const content = readFileSync(file, 'utf-8');
      let searchFrom = 0;
      for (;;) {
        const callStart = content.indexOf(DECORATOR_CALL_START, searchFrom);
        if (callStart === -1) break;
        const openParenIndex = callStart + DECORATOR_CALL_START.length - 1;
        const args = extractBalancedArgs(content, openParenIndex);
        searchFrom = openParenIndex + args.length + 2;

        const parsed = parseDecoratorCall(args);
        if (!parsed) continue;

        const [resource, action] = parsed.permission.split(':');
        const key = `${service}::${parsed.permission}`;
        found.set(key, {
          service,
          permission: parsed.permission,
          resource,
          action,
          name: parsed.name,
          plane: 'api',
        });
      }
    }
  }

  return [...found.values()];
}

/** Scans `apps/<service>/views/**` and `apps/<service>/public/**` for
 * `data-permission="resource:action"` attributes — the `page:*`/`component:*`
 * UI-plane counterpart of {@link scanApiPermissions}. These never carry a
 * `{ th, en }` name (there's nowhere to put one on an HTML attribute), so
 * `name` is always undefined and the row gets a humanized placeholder.
 *
 * Also reads `apps/<service>/ui-permissions.manifest.json` if present — the
 * declarative alternative for frontends that can't be regex-scanned (see
 * {@link IUiPermissionsManifest}). A service can use either source, or both;
 * results are merged (manifest entries win on key collision, since a
 * manifest entry always carries an explicit name and an attribute scan
 * never does). */
export function scanUiPermissions(): IScannedPermission[] {
  const found = new Map<string, IScannedPermission>();

  for (const service of readdirSync(APPS_ROOT)) {
    const scanDirs = ['views', 'public']
      .map((sub) => join(APPS_ROOT, service, sub))
      .filter((dir) => {
        try {
          return statSync(dir).isDirectory();
        } catch {
          return false;
        }
      });

    for (const dir of scanDirs) {
      for (const file of walk(dir, isViewFile)) {
        const content = readFileSync(file, 'utf-8');
        for (const match of content.matchAll(UI_PERMISSION_LITERAL)) {
          const permission = match[2];
          const [resource, action] = permission.split(':');
          const key = `${service}::${permission}`;
          found.set(key, {
            service,
            permission,
            resource,
            action,
            name: undefined,
            plane: 'ui',
          });
        }
      }
    }

    for (const scanned of scanUiPermissionsManifest(service)) {
      found.set(`${scanned.service}::${scanned.permission}`, scanned);
    }
  }

  return [...found.values()];
}

/** Reads `apps/<service>/ui-permissions.manifest.json` (if it exists) and
 * flattens it into the same shape a `data-permission` scan produces —
 * pages first, then each page's components. Malformed JSON logs a warning
 * and is skipped rather than failing the whole platform-wide sync, since
 * one frontend's bad manifest shouldn't block every other service's rows. */
function scanUiPermissionsManifest(service: string): IScannedPermission[] {
  const manifestPath = join(
    APPS_ROOT,
    service,
    UI_PERMISSIONS_MANIFEST_FILENAME,
  );
  try {
    if (!statSync(manifestPath).isFile()) return [];
  } catch {
    return [];
  }

  let manifest: IUiPermissionsManifest;
  try {
    manifest = JSON.parse(
      readFileSync(manifestPath, 'utf-8'),
    ) as IUiPermissionsManifest;
  } catch (error) {
    console.warn(
      `⚠ Skipping ${manifestPath}: not valid JSON (${(error as Error).message})`,
    );
    return [];
  }

  const scanned: IScannedPermission[] = [];
  for (const page of manifest.pages ?? []) {
    const [pageResource, pageAction] = page.permission.split(':');
    scanned.push({
      service,
      permission: page.permission,
      resource: pageResource,
      action: pageAction,
      name: page.name,
      plane: 'ui',
    });

    for (const component of page.components ?? []) {
      const [resource, action] = component.permission.split(':');
      scanned.push({
        service,
        permission: component.permission,
        resource,
        action,
        name: component.name,
        plane: 'ui',
      });
    }
  }

  return scanned;
}

export function humanize(word: string): string {
  return word
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
