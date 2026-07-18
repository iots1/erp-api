import 'dotenv/config';

import { readdirSync, readFileSync, statSync } from 'fs';
import { hostname } from 'os';
import { join } from 'path';

import { Client } from 'pg';

import {
  IUiPermissionsManifest,
  UI_PERMISSIONS_MANIFEST_FILENAME,
} from './ui-permissions-manifest.schema';

/**
 * Scans every `apps/<service>/src/**` file for `@RequirePermission('resource:action')`
 * (optionally with a `{ th, en }` display name — see `require-permission.decorator.ts`)
 * *and* every `apps/<service>/views/**` + `apps/<service>/public/**` file for
 * `data-permission="resource:action"` attributes, *and* each service's
 * optional `ui-permissions.manifest.json` (see `ui-permissions-manifest.schema.ts`
 * — the declarative alternative for frontends, e.g. a future Next.js app,
 * that can't be regex-scanned for a literal attribute), then syncs all of it
 * into iam's `permissions` catalog table — `@RequirePermission()` hits become
 * `plane = 'api'` rows, the other two sources become `plane = 'ui'` rows
 * (`page:*`, `component:*`):
 *
 * - New (service, permission) pairs are inserted.
 * - Pairs found again after being previously stale are un-soft-deleted.
 * - Pairs no longer found in code are soft-deleted (never hard-deleted — other
 *   tables like `statement_actions` may still reference the row, and there's no
 *   FK forcing that to stay consistent; soft-delete keeps history intact).
 * - A `permission_sync_logs` row records what changed this run (added/removed),
 *   so `permissions:sync` runs form an auditable history.
 * - When the decorator provides `{ th, en }`, that name always wins on sync
 *   (the developer is the source of truth). `data-permission` attributes never
 *   carry a name, so ui rows always get a humanized placeholder. Either way, a
 *   placeholder name is only set on first insert and never overwritten — so an
 *   admin's manual edit in the `permissions` table survives later syncs.
 *
 * `permission` (resource:action) is only unique *within* a service — two BCs can
 * legitimately declare the same string for unrelated endpoints — so the scan key
 * is always (service, permission), never permission alone.
 *
 * api and ui rows are synced independently (separate existing-set / diff / plane
 * filter) so a fresh installation gets both from a clean `permissions:sync` run —
 * no more hand-writing `SeedIamUiPermissions`-style migrations for every new
 * sidebar item, though those still work fine for one-off grants to existing
 * policies (sync only touches the `permissions` catalog, never `statement_actions`).
 */

const APPS_ROOT = join(__dirname, '../../../../apps');
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

interface IScannedPermission {
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

function scanApiPermissions(): IScannedPermission[] {
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
function scanUiPermissions(): IScannedPermission[] {
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

function humanize(word: string): string {
  return word
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface IPlaneDiff {
  added: IScannedPermission[];
  removed: Array<{ service: string; permission: string }>;
  unchanged: IScannedPermission[];
}

/** Diffs `scanned` (one plane's worth) against that plane's existing catalog
 * rows and applies inserts/un-deletes/soft-deletes within the caller's
 * transaction. Each plane is synced independently — a `ui` scan never touches
 * `api` rows and vice versa, since a resource:action string can coincidentally
 * collide across planes. */
async function syncPlane(
  client: Client,
  plane: 'api' | 'ui',
  scanned: IScannedPermission[],
  removedReason: string,
): Promise<IPlaneDiff> {
  // is_manual = false only — rows added through the iam-view Permissions page
  // are invisible to this diff entirely: never counted as "removed" (so never
  // soft-deleted) and never conflict-matched for an update, since a manual
  // row's identity is admin-owned, not code-owned. See PermissionsService
  // (apps/iam/src/modules/permissions/services/permissions.service.ts) for
  // the API-side half of this guarantee (DELETE refuses non-manual rows).
  const { rows: existingRows } = await client.query<{
    service: string;
    permission: string;
  }>(
    `SELECT service, permission FROM permissions WHERE is_deleted = false AND plane = $1 AND is_manual = false`,
    [plane],
  );
  const existing = new Set(
    existingRows.map((r) => `${r.service}::${r.permission}`),
  );
  const scannedKeys = new Set(
    scanned.map((p) => `${p.service}::${p.permission}`),
  );

  const added = scanned.filter(
    (p) => !existing.has(`${p.service}::${p.permission}`),
  );
  const unchanged = scanned.filter((p) =>
    existing.has(`${p.service}::${p.permission}`),
  );
  const removed = existingRows.filter(
    (r) => !scannedKeys.has(`${r.service}::${r.permission}`),
  );

  for (const p of scanned) {
    const hasExplicitName = p.name !== undefined;
    // Placeholder is only used on first insert; ON CONFLICT keeps the existing
    // name unless this run supplied an explicit { th, en } (never true for ui
    // rows — data-permission attributes carry no name).
    const placeholder = `${humanize(p.action)} ${humanize(p.resource)}`;
    const nameTh = p.name?.th ?? placeholder;
    const nameEn = p.name?.en ?? placeholder;

    // is_manual is intentionally absent from the UPDATE SET clause — if this
    // insert happens to conflict with a row an admin already added manually
    // (e.g. code catches up to a permission pre-declared via the Permissions
    // page), it stays is_manual = true. New rows are always is_manual = false.
    await client.query(
      `INSERT INTO permissions (service, permission, resource, action, plane, permission_name_th, permission_name_en, is_deleted, deleted_at, deleted_reason, is_manual)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, NULL, NULL, false)
       ON CONFLICT (service, permission) DO UPDATE SET
         resource = EXCLUDED.resource,
         action = EXCLUDED.action,
         permission_name_th = CASE WHEN $8 THEN EXCLUDED.permission_name_th ELSE permissions.permission_name_th END,
         permission_name_en = CASE WHEN $8 THEN EXCLUDED.permission_name_en ELSE permissions.permission_name_en END,
         is_deleted = false,
         deleted_at = NULL,
         deleted_reason = NULL,
         updated_at = now()`,
      [
        p.service,
        p.permission,
        p.resource,
        p.action,
        plane,
        nameTh,
        nameEn,
        hasExplicitName,
      ],
    );
  }

  for (const r of removed) {
    await client.query(
      `UPDATE permissions SET is_deleted = true, deleted_at = now(), deleted_reason = $3
       WHERE service = $1 AND permission = $2 AND is_manual = false`,
      [r.service, r.permission, removedReason],
    );
  }

  return { added, removed, unchanged };
}

async function main(): Promise<void> {
  const apiScanned = scanApiPermissions();
  const uiScanned = scanUiPermissions();
  console.log(
    `Scanned ${apiScanned.length} api (@RequirePermission) + ${uiScanned.length} ui (data-permission) permission pairs.`,
  );

  const client = new Client({
    host: process.env.IAM_DB_HOST ?? 'localhost',
    port: Number(process.env.IAM_DB_PORT ?? 5432),
    user: process.env.IAM_DB_USERNAME ?? 'postgres',
    password: process.env.IAM_DB_PASSWORD ?? 'postgres',
    database: process.env.IAM_DB_NAME ?? 'erp_iam',
  });
  await client.connect();

  try {
    await client.query('BEGIN');

    const apiDiff = await syncPlane(
      client,
      'api',
      apiScanned,
      'no longer declared via @RequirePermission()',
    );
    const uiDiff = await syncPlane(
      client,
      'ui',
      uiScanned,
      'no longer declared via data-permission attribute',
    );

    const added = [...apiDiff.added, ...uiDiff.added];
    const removed = [...apiDiff.removed, ...uiDiff.removed];
    const unchanged = [...apiDiff.unchanged, ...uiDiff.unchanged];

    await client.query(
      `INSERT INTO permission_sync_logs (added, removed, added_count, removed_count, unchanged_count, triggered_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        JSON.stringify(
          added.map(({ service, permission, plane }) => ({
            service,
            permission,
            plane,
          })),
        ),
        JSON.stringify(
          removed.map(({ service, permission }) => ({ service, permission })),
        ),
        added.length,
        removed.length,
        unchanged.length,
        hostname(),
      ],
    );

    await client.query('COMMIT');

    const withExplicitName = apiScanned.filter(
      (p) => p.name !== undefined,
    ).length;

    console.log(`Added:     ${added.length}`);
    added.forEach((p) =>
      console.log(
        `  + [${p.service}] (${p.plane}) ${p.permission}${p.name ? '' : ' (placeholder name)'}`,
      ),
    );
    console.log(`Removed:   ${removed.length} (soft-deleted, not dropped)`);
    removed.forEach((p) => console.log(`  - [${p.service}] ${p.permission}`));
    console.log(`Unchanged: ${unchanged.length}`);
    console.log(
      `Api permissions with explicit { th, en } name: ${withExplicitName}/${apiScanned.length}`,
    );
    if (apiScanned.some((p) => p.name === undefined) || uiScanned.length > 0) {
      console.log(
        '\nNote: api permissions without an explicit { th, en } and every ui permission got a placeholder name (humanized from the action/resource) — edit the permissions table directly to give them a proper display name.',
      );
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main();
