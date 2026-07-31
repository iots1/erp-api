import 'dotenv/config';

import { hostname } from 'os';

import { Client } from 'pg';

import {
  derivePlaceholderName,
  IScannedPermission,
  scanApiPermissions,
  scanUiPermissions,
} from './permission-sync-scan.util';

/**
 * Scans every `apps/<service>/src/**` file for `@RequirePermission('resource:action')`
 * (optionally with a `{ th, en }` display name — see `require-permission.decorator.ts`)
 * *and* every `apps/<service>/views/**` + `apps/<service>/public/**` file for
 * `data-permission="resource:action"` attributes, *and* each service's
 * optional `ui-permissions.manifest.json` (see `ui-permissions-manifest.schema.ts`
 * — the declarative alternative for frontends, e.g. a future Next.js app,
 * that can't be regex-scanned for a literal attribute) — see
 * `permission-sync-scan.util.ts` for the scanning half — then syncs all of it
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
 *
 * This CLI entrypoint is a thin wrapper around the same diff/apply logic the
 * "Sync Permissions" button in the iam admin UI runs in-process — see
 * `apps/iam/src/modules/permissions/services/permissions-sync.service.ts`.
 */

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
    const placeholder = derivePlaceholderName(p.permission);
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
