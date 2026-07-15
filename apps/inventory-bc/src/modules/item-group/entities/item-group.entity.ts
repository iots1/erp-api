import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

/**
 * Product category tree (nested-set: `lft`/`rgt`, rebuilt in full by
 * `ItemGroupsService` on every insert/re-parent/delete). Only leaf nodes
 * (`is_group=false`) may be attached to a product.
 */
@Entity({ name: 'item_groups', database: ErpDatabases.INVENTORY })
@Index('idx_item_groups_parent_item_group_id', ['parent_item_group_id'])
export class ItemGroup extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 150,
    comment: 'ชื่อกลุ่ม (ไทย) / Group name (Thai)',
  })
  name_th: string;

  @Column({
    type: 'varchar',
    length: 150,
    comment: 'ชื่อกลุ่ม (อังกฤษ) / Group name (English)',
  })
  name_en: string;

  @Column({
    type: 'boolean',
    comment: 'node (true) / leaf (false) — เฉพาะ leaf ที่ผูกสินค้าได้',
  })
  is_group: boolean;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'กลุ่มแม่ (null = root) / Parent item group (self ref tree)',
  })
  parent_item_group_id: string | null;

  @Column({
    type: 'int',
    default: 0,
    comment: 'nested-set left bound (คำนวณโดยระบบ)',
  })
  lft: number;

  @Column({
    type: 'int',
    default: 0,
    comment: 'nested-set right bound (คำนวณโดยระบบ)',
  })
  rgt: number;
}
