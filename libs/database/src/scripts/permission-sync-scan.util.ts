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

/** A permission string is exactly one `<prefix>:<action>` pair — no second
 * colon, no punctuation. Used to reject anything a hand-written manifest might
 * put in the `permission` field before it reaches the catalog. */
const PERMISSION_STRING = /^([a-zA-Z0-9_]+):([a-zA-Z0-9_]+)$/;
/** The two prefixes that make a permission ui-plane, and the two levels of a
 * manifest's tree. A manifest may only ever declare these (see
 * {@link IUiPermissionsManifest}); an api-plane string smuggled into one would
 * end up owned by both planes' diffs, which soft-delete each other's rows. */
type UiPermissionPrefix = 'page' | 'component';

/**
 * Splits a permission string into the `resource` / `action` pair stored on the
 * catalog row.
 *
 * `action` is always the part after the colon, but `resource` is **not** simply
 * the part before it: every `page:*` permission gets its own per-page resource
 * (`page:view_dashboard` → `page_dashboard`), matching what the hand-written
 * seed migrations have always inserted (`SeedIamBootstrapData`,
 * `SeedIamUiPermissions`, `SeedAccessKeysUiPermission`, …). That per-page value
 * is what the Policy Generator's "หน้าจอ / Component Group (UI)" dropdown
 * groups by (`getDropdown1Options` in `permissions.service.js`), so deriving a
 * bare `page` here instead collapsed *every* page onto a single dropdown entry
 * — and, because both sync paths `UPDATE … SET resource = EXCLUDED.resource`,
 * each sync run also overwrote the correct per-page values already seeded for
 * `iam`'s own pages.
 *
 * `component:*` and every api-plane permission keep the prefix as their
 * resource (`component:btn_add_user` → `component`, `role:create` → `role`),
 * which is what the migrations seed too. A component nested under a page in a
 * `ui-permissions.manifest.json` is the exception — the manifest scan
 * overwrites its resource with the parent page's, so the two end up in the
 * same dropdown group. `component` is therefore only the group for components
 * with no declared page.
 *
 * Returns `null` for anything that isn't a well-formed `<prefix>:<action>`
 * pair, so callers can skip it instead of inserting a half-parsed row.
 */
export function derivePermissionParts(
  permission: string,
): { resource: string; action: string } | null {
  const match = PERMISSION_STRING.exec(permission);
  if (!match) return null;

  const [, prefix, action] = match;
  if (prefix !== 'page') return { resource: prefix, action };

  // `page:view_dashboard` and a hypothetical `page:dashboard` both belong to
  // the same page group. The `|| action` guard keeps a degenerate `page:view_`
  // from producing the empty resource `page_`.
  const slug = action.replace(/^view_/, '') || action;
  return { resource: `page_${slug}`, action };
}

/**
 * Fallback display name for a scanned permission that carries no explicit
 * `{ th, en }` (every `data-permission` attribute, since an HTML attribute has
 * nowhere to put one). Deliberately built from the raw `<prefix>` rather than
 * {@link derivePermissionParts}' `resource`, so a page still reads
 * "View Dashboard Page" instead of "View Dashboard Page Dashboard".
 */
export function derivePlaceholderName(permission: string): string {
  const match = PERMISSION_STRING.exec(permission);
  if (!match) return humanize(permission);

  const [, prefix, action] = match;
  return `${humanize(action)} ${humanize(prefix)}`;
}

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

        const parts = derivePermissionParts(parsed.permission);
        if (!parts) continue;

        const key = `${service}::${parsed.permission}`;
        found.set(key, {
          service,
          permission: parsed.permission,
          resource: parts.resource,
          action: parts.action,
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
          const parts = derivePermissionParts(permission);
          if (!parts) continue;

          const key = `${service}::${permission}`;
          found.set(key, {
            service,
            permission,
            resource: parts.resource,
            action: parts.action,
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** A manifest `name` is only honoured when *both* halves of the bilingual pair
 * are present — a half-filled `{ th }` would otherwise overwrite the catalog's
 * `permission_name_en` with the Thai string on every sync. Returning undefined
 * falls back to {@link derivePlaceholderName}. */
function parseManifestName(
  value: unknown,
): { th: string; en: string } | undefined {
  if (!isRecord(value)) return undefined;
  const { th, en } = value;
  return isNonEmptyString(th) && isNonEmptyString(en) ? { th, en } : undefined;
}

/** Validates one manifest page/component entry and flattens it into the same
 * shape a `data-permission` scan produces. `expectedPrefix` is where the entry
 * was found in the manifest tree, so a `component:*` listed as a page (or vice
 * versa) is rejected rather than silently landing in the wrong group. Returns
 * null (after warning) for an entry the catalog can't safely take. */
function parseManifestEntry(
  service: string,
  entry: unknown,
  manifestPath: string,
  expectedPrefix: UiPermissionPrefix,
): IScannedPermission | null {
  if (!isRecord(entry) || !isNonEmptyString(entry.permission)) {
    console.warn(
      `⚠ ${manifestPath}: skipping ${expectedPrefix} entry with a missing or non-string "permission".`,
    );
    return null;
  }

  const permission = entry.permission;
  const parts = derivePermissionParts(permission);
  if (!parts) {
    console.warn(
      `⚠ ${manifestPath}: skipping "${permission}" — not a valid <resource>:<action> pair.`,
    );
    return null;
  }

  // A manifest only ever produces ui-plane rows. Letting an api-plane string
  // through would give one `(service, permission)` row two owning planes, and
  // each plane's diff would soft-delete what the other just inserted.
  if (!permission.startsWith(`${expectedPrefix}:`)) {
    console.warn(
      `⚠ ${manifestPath}: skipping "${permission}" — an entry listed as a ${expectedPrefix} must be a "${expectedPrefix}:*" permission.`,
    );
    return null;
  }

  return {
    service,
    permission,
    resource: parts.resource,
    action: parts.action,
    name: parseManifestName(entry.name),
    plane: 'ui',
  };
}

/** Reads `apps/<service>/ui-permissions.manifest.json` (if it exists) and
 * flattens it into the same shape a `data-permission` scan produces —
 * pages first, then each page's components. Malformed JSON, and any
 * individually malformed entry inside otherwise-valid JSON, logs a warning
 * and is skipped rather than failing the whole platform-wide sync: the file is
 * hand-written, and one frontend's bad manifest shouldn't block every other
 * service's rows (or crash the in-app "Sync Permissions" button). */
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

  let manifest: unknown;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (error) {
    console.warn(
      `⚠ Skipping ${manifestPath}: not valid JSON (${(error as Error).message})`,
    );
    return [];
  }

  const pages = isRecord(manifest) ? manifest.pages : undefined;
  if (pages !== undefined && !Array.isArray(pages)) {
    console.warn(`⚠ Skipping ${manifestPath}: "pages" must be an array.`);
    return [];
  }

  const scanned: IScannedPermission[] = [];
  for (const page of (pages ?? []) as IUiPermissionsManifest['pages']) {
    const scannedPage = parseManifestEntry(service, page, manifestPath, 'page');
    if (scannedPage) scanned.push(scannedPage);

    const components = isRecord(page) ? page.components : undefined;
    if (components !== undefined && !Array.isArray(components)) {
      console.warn(
        `⚠ ${manifestPath}: ignoring "components" of "${isRecord(page) ? String(page.permission) : '?'}" — must be an array.`,
      );
      continue;
    }

    for (const component of components ?? []) {
      const scannedComponent = parseManifestEntry(
        service,
        component,
        manifestPath,
        'component',
      );
      if (!scannedComponent) continue;

      // A nested component takes its parent page's resource rather than the
      // generic `component`, so the Policy Generator's "หน้าจอ / Component
      // Group (UI)" dropdown offers one entry per page whose checkbox list is
      // the page permission plus everything gated on that page. A component
      // whose parent page entry was itself rejected keeps the generic
      // `component` group — it still has to land somewhere selectable.
      if (scannedPage) scannedComponent.resource = scannedPage.resource;
      scanned.push(scannedComponent);
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
