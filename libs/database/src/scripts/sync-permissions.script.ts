import 'dotenv/config';

import { readdirSync, readFileSync, statSync } from 'fs';
import { hostname } from 'os';
import { join } from 'path';

import { Client } from 'pg';

/**
 * Scans every `apps/<service>/src/**` file for `@RequirePermission('resource:action')`
 * (optionally with a `{ th, en }` display name — see `require-permission.decorator.ts`)
 * and syncs the result into iam's `permissions` catalog table:
 *
 * - New (service, permission) pairs are inserted.
 * - Pairs found again after being previously stale are un-soft-deleted.
 * - Pairs no longer found in code are soft-deleted (never hard-deleted — other
 *   tables like `statement_actions` may still reference the row, and there's no
 *   FK forcing that to stay consistent; soft-delete keeps history intact).
 * - A `permission_sync_logs` row records what changed this run (added/removed),
 *   so `permissions:sync` runs form an auditable history.
 * - When the decorator provides `{ th, en }`, that name always wins on sync
 *   (the developer is the source of truth). Without it, a placeholder name is
 *   only set on first insert and never overwritten — so an admin's manual edit
 *   in the `permissions` table survives later syncs.
 *
 * `permission` (resource:action) is only unique *within* a service — two BCs can
 * legitimately declare the same string for unrelated endpoints — so the scan key
 * is always (service, permission), never permission alone.
 *
 * Only ever touches `plane = 'api'` rows. `ui` permissions (`page:*`, `component:*`)
 * come from frontend `data-permission` attributes, not `@RequirePermission()` — they
 * are managed manually and this script never adds, updates, or soft-deletes them.
 */

const APPS_ROOT = join(__dirname, '../../../../apps');
const DECORATOR_CALL_START = '@RequirePermission(';

interface IScannedPermission {
  service: string;
  permission: string;
  resource: string;
  action: string;
  name: { th: string; en: string } | undefined;
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

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

function scanPermissions(): IScannedPermission[] {
  const found = new Map<string, IScannedPermission>();

  for (const service of readdirSync(APPS_ROOT)) {
    const srcDir = join(APPS_ROOT, service, 'src');
    try {
      if (!statSync(srcDir).isDirectory()) continue;
    } catch {
      continue;
    }

    for (const file of walk(srcDir)) {
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
        });
      }
    }
  }

  return [...found.values()];
}

function humanize(word: string): string {
  return word
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function main(): Promise<void> {
  const scanned = scanPermissions();
  console.log(
    `Scanned ${scanned.length} unique (service, permission) pairs from @RequirePermission() usage.`,
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
    // Scoped to plane = 'api' only — `ui` permissions (page:*/component:*) are
    // manually curated (frontend data-permission attributes, not @RequirePermission()
    // calls) and must never be touched by this sync, added or soft-deleted.
    const { rows: existingRows } = await client.query<{
      service: string;
      permission: string;
    }>(
      `SELECT service, permission FROM permissions WHERE is_deleted = false AND plane = 'api'`,
    );
    const existing = new Set(
      existingRows.map((r) => `${r.service}::${r.permission}`),
    );
    const scannedKeys = new Set(
      scanned.map((p) => `${p.service}::${p.permission}`),
    );

    const added: IScannedPermission[] = scanned.filter(
      (p) => !existing.has(`${p.service}::${p.permission}`),
    );
    const unchanged = scanned.filter((p) =>
      existing.has(`${p.service}::${p.permission}`),
    );
    const removed = existingRows.filter(
      (r) => !scannedKeys.has(`${r.service}::${r.permission}`),
    );
    const withExplicitName = scanned.filter((p) => p.name !== undefined).length;

    await client.query('BEGIN');

    for (const p of scanned) {
      const hasExplicitName = p.name !== undefined;
      // Placeholder is only used on first insert; ON CONFLICT keeps the existing
      // name unless the decorator supplied an explicit { th, en } this run.
      const placeholder = `${humanize(p.action)} ${humanize(p.resource)}`;
      const nameTh = p.name?.th ?? placeholder;
      const nameEn = p.name?.en ?? placeholder;

      await client.query(
        `INSERT INTO permissions (service, permission, resource, action, plane, permission_name_th, permission_name_en, is_deleted, deleted_at, deleted_reason)
         VALUES ($1, $2, $3, $4, 'api', $5, $6, false, NULL, NULL)
         ON CONFLICT (service, permission) DO UPDATE SET
           resource = EXCLUDED.resource,
           action = EXCLUDED.action,
           permission_name_th = CASE WHEN $7 THEN EXCLUDED.permission_name_th ELSE permissions.permission_name_th END,
           permission_name_en = CASE WHEN $7 THEN EXCLUDED.permission_name_en ELSE permissions.permission_name_en END,
           is_deleted = false,
           deleted_at = NULL,
           deleted_reason = NULL,
           updated_at = now()`,
        [
          p.service,
          p.permission,
          p.resource,
          p.action,
          nameTh,
          nameEn,
          hasExplicitName,
        ],
      );
    }

    for (const r of removed) {
      await client.query(
        `UPDATE permissions SET is_deleted = true, deleted_at = now(), deleted_reason = 'no longer declared via @RequirePermission()'
         WHERE service = $1 AND permission = $2`,
        [r.service, r.permission],
      );
    }

    await client.query(
      `INSERT INTO permission_sync_logs (added, removed, added_count, removed_count, unchanged_count, triggered_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        JSON.stringify(
          added.map(({ service, permission }) => ({ service, permission })),
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

    console.log(`Added:     ${added.length}`);
    added.forEach((p) =>
      console.log(
        `  + [${p.service}] ${p.permission}${p.name ? '' : ' (placeholder name)'}`,
      ),
    );
    console.log(`Removed:   ${removed.length} (soft-deleted, not dropped)`);
    removed.forEach((p) => console.log(`  - [${p.service}] ${p.permission}`));
    console.log(`Unchanged: ${unchanged.length}`);
    console.log(
      `With explicit { th, en } name: ${withExplicitName}/${scanned.length}`,
    );
    if (scanned.some((p) => p.name === undefined)) {
      console.log(
        '\nNote: some @RequirePermission() calls have no { th, en } name — those got a placeholder (humanized from the action/resource). Add a name in the decorator or edit the permissions table directly.',
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
