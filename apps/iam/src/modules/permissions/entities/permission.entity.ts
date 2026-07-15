import { Check, Column, Entity, Index, Unique } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

export type PermissionPlane = 'ui' | 'api';

/**
 * `permission` (resource:action) is only unique *within* the declaring `service` —
 * the same string may be reused by different BCs for unrelated things, so the real
 * business key is (service, permission), not permission alone.
 */
@Entity({
  name: 'permissions',
  database: ErpDatabases.IAM,
  comment:
    'แคตตาล็อกสิทธิ์ (resource:action) — i18n — synced from @RequirePermission() usage',
})
@Check('chk_permissions_plane', `"plane" IN ('ui', 'api')`)
@Unique('uq_permissions_service_permission', ['service', 'permission'])
@Index('idx_permissions_service', ['service'])
export class Permission extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    comment:
      'BC ที่ประกาศสิทธิ์นี้ เช่น iam, auth, inventory-bc (มาจาก path apps/<service>)',
  })
  service: string;

  @Column({
    type: 'varchar',
    length: 150,
    comment:
      'รูป resource:action เช่น goods_receipt:submit — unique เฉพาะภายใน service เดียวกัน (uq_permissions_service_permission)',
  })
  permission: string;

  @Column({ type: 'varchar', length: 100, comment: 'ทรัพยากร' })
  resource: string;

  @Column({ type: 'varchar', length: 100, comment: 'การกระทำ' })
  action: string;

  @Column({ type: 'varchar', length: 10, comment: 'ui | api' })
  plane: PermissionPlane;

  @Column({
    type: 'varchar',
    length: 200,
    comment: 'ชื่อที่แสดงในหน้า Policy Generator (ไทย)',
  })
  permission_name_th: string;

  @Column({
    type: 'varchar',
    length: 200,
    comment: 'ชื่อที่แสดงในหน้า Policy Generator (English)',
  })
  permission_name_en: string;
}
