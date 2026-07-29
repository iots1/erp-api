import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource, EntityManager } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import {
  humanize,
  IScannedPermission,
  scanApiPermissions,
  scanUiPermissions,
} from '@lib/database/scripts/permission-sync-scan.util';

import { Permission } from '../entities/permission.entity';
import { PermissionSyncLog } from '../entities/permission-sync-log.entity';

interface IPlaneDiff {
  added: IScannedPermission[];
  removed: Array<{ service: string; permission: string }>;
  unchanged: IScannedPermission[];
}

/**
 * In-process twin of `libs/database/src/scripts/sync-permissions.script.ts`
 * (the `permissions:sync` CLI) — powers the "Sync Permissions" button on the
 * iam Permissions admin page so an operator never has to shell in to run the
 * npm script. Both share the same scanning logic
 * (`permission-sync-scan.util.ts`); only the DB-write half is duplicated here
 * using the app's own TypeORM connection instead of a standalone `pg.Client`,
 * since re-deriving PG connection env vars inside a running NestJS process
 * would just fight the app's own already-configured DataSource.
 */
@Injectable()
export class PermissionsSyncService {
  constructor(
    @InjectDataSource(ErpDatabases.IAM)
    private readonly dataSource: DataSource,
  ) {}

  async runSync(triggeredBy: string): Promise<PermissionSyncLog> {
    const apiScanned = scanApiPermissions();
    const uiScanned = scanUiPermissions();

    return this.dataSource.transaction(async (manager) => {
      const apiDiff = await this.syncPlane(
        manager,
        'api',
        apiScanned,
        'no longer declared via @RequirePermission()',
      );
      const uiDiff = await this.syncPlane(
        manager,
        'ui',
        uiScanned,
        'no longer declared via data-permission attribute',
      );

      const added = [...apiDiff.added, ...uiDiff.added];
      const removed = [...apiDiff.removed, ...uiDiff.removed];
      const unchanged = [...apiDiff.unchanged, ...uiDiff.unchanged];

      const log = manager.create(PermissionSyncLog, {
        added: added.map(({ service, permission, plane }) => ({
          service,
          permission,
          plane,
        })),
        removed: removed.map(({ service, permission }) => ({
          service,
          permission,
        })),
        added_count: added.length,
        removed_count: removed.length,
        unchanged_count: unchanged.length,
        triggered_by: triggeredBy,
      });
      return manager.save(log);
    });
  }

  /** Diffs `scanned` (one plane's worth) against that plane's existing catalog
   * rows and applies inserts/un-deletes/soft-deletes within the caller's
   * transaction — mirrors `syncPlane()` in the CLI script. */
  private async syncPlane(
    manager: EntityManager,
    plane: 'api' | 'ui',
    scanned: IScannedPermission[],
    removedReason: string,
  ): Promise<IPlaneDiff> {
    const repo = manager.getRepository(Permission);

    // is_manual = false only — rows added through the iam-view Permissions page
    // are invisible to this diff entirely: never counted as "removed" (so never
    // soft-deleted) and never conflict-matched for an update, since a manual
    // row's identity is admin-owned, not code-owned.
    const existingRows = await repo.find({
      select: ['service', 'permission'],
      where: { plane, is_manual: false, is_deleted: false },
    });
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
      const placeholder = `${humanize(p.action)} ${humanize(p.resource)}`;
      const nameTh = p.name?.th ?? placeholder;
      const nameEn = p.name?.en ?? placeholder;

      const existingRow = await repo.findOne({
        where: { service: p.service, permission: p.permission },
      });

      if (existingRow) {
        // is_manual is intentionally left untouched — if this scan happens to
        // conflict with a row an admin already added manually (e.g. code
        // catches up to a permission pre-declared via the Permissions page),
        // it stays is_manual = true.
        await repo.update(existingRow.id, {
          resource: p.resource,
          action: p.action,
          ...(hasExplicitName
            ? { permission_name_th: nameTh, permission_name_en: nameEn }
            : {}),
          is_deleted: false,
          deleted_at: null,
          deleted_reason: null,
        });
      } else {
        await repo.insert({
          service: p.service,
          permission: p.permission,
          resource: p.resource,
          action: p.action,
          plane,
          permission_name_th: nameTh,
          permission_name_en: nameEn,
          is_manual: false,
        });
      }
    }

    for (const r of removed) {
      await repo.update(
        { service: r.service, permission: r.permission, is_manual: false },
        { is_deleted: true, deleted_at: new Date(), deleted_reason: removedReason },
      );
    }

    return { added, removed, unchanged };
  }
}
