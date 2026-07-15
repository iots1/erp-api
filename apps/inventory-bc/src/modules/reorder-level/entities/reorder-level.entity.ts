import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

/** Reorder point (จุดสั่งซื้อ) for a product at a specific warehouse — optional master data. */
@Entity({ name: 'reorder_levels', database: ErpDatabases.INVENTORY })
@Index('idx_reorder_levels_product_id', ['product_id'])
@Index('idx_reorder_levels_warehouse_id', ['warehouse_id'])
export class ReorderLevel extends BaseEntity {
  @Column({ type: 'uuid', comment: 'สินค้าที่เฝ้าระวัง / Product ID' })
  product_id: string;

  @Column({ type: 'uuid', comment: 'คลังที่ตั้งจุดสั่งซื้อ / Warehouse ID' })
  warehouse_id: string;

  @Column({
    type: 'int',
    comment:
      'จำนวนขั้นต่ำ — ต่ำกว่านี้จะแจ้งเตือน (stock.low ใน P3) / Alert quantity',
  })
  alert_qty: number;
}
