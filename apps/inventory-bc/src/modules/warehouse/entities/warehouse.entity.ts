import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

export enum WarehouseType {
  STOCK = 'stock',
  TRANSIT = 'transit',
  REJECT = 'reject',
}

/**
 * Warehouse tree (nested-set: `lft`/`rgt`, rebuilt in full by
 * `WarehousesService` on every insert/re-parent/delete). Only leaf nodes
 * (`is_group=false`) of type `stock` may receive Goods Receipt (Phase 3).
 */
@Entity({ name: 'warehouses', database: ErpDatabases.INVENTORY })
@Index('idx_warehouses_parent_warehouse_id', ['parent_warehouse_id'])
export class Warehouse extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 150,
    comment: 'ชื่อคลัง (ไทย) / Warehouse name (Thai)',
  })
  name_th: string;

  @Column({
    type: 'varchar',
    length: 150,
    comment: 'ชื่อคลัง (อังกฤษ) / Warehouse name (English)',
  })
  name_en: string;

  @Column({
    type: 'enum',
    enum: WarehouseType,
    comment: 'stock | transit (โอนข้ามสาขา) | reject (ของเสีย)',
  })
  warehouse_type: WarehouseType;

  @Column({
    type: 'boolean',
    comment: 'node/leaf — เฉพาะ leaf ที่เก็บสต็อก/รับสินค้าได้',
  })
  is_group: boolean;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'คลังแม่ (null = root) / Parent warehouse (self ref tree)',
  })
  parent_warehouse_id: string | null;

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
