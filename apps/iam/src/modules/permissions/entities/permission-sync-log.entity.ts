import { Column, Entity } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

export interface IPermissionSyncEntry {
  service: string;
  permission: string;
}

/**
 * One row per `permissions:sync` run — records what changed so admins can audit
 * "what did the last deploy add/remove from the permission catalog" (`created_at`
 * from BaseEntity is the run timestamp).
 */
@Entity({
  name: 'permission_sync_logs',
  database: ErpDatabases.IAM,
  comment:
    'ประวัติการ sync แคตตาล็อก permissions จาก @RequirePermission() ในโค้ด',
})
export class PermissionSyncLog extends BaseEntity {
  @Column({
    type: 'jsonb',
    default: () => `'[]'`,
    comment: 'permission ที่เพิ่มใหม่รอบนี้',
  })
  added: IPermissionSyncEntry[];

  @Column({
    type: 'jsonb',
    default: () => `'[]'`,
    comment: 'permission ที่หายไปรอบนี้ (soft-deleted ไม่ถูกลบจริง)',
  })
  removed: IPermissionSyncEntry[];

  @Column({ type: 'int', default: 0, comment: 'จำนวนที่เพิ่ม' })
  added_count: number;

  @Column({ type: 'int', default: 0, comment: 'จำนวนที่หายไป' })
  removed_count: number;

  @Column({ type: 'int', default: 0, comment: 'จำนวนที่ไม่เปลี่ยนแปลง' })
  unchanged_count: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'ผู้/สิ่งที่รัน sync เช่น hostname',
  })
  triggered_by: string | null;
}
