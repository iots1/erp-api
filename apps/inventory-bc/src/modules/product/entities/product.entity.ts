import { Column, Entity, Index, Unique } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

export enum ProductType {
  SINGLE = 'single',
  BUNDLE = 'bundle',
}

/**
 * Item master (products). Covers all four shapes described in srs-p2.html §2.2:
 * single item, variant template (`has_variants=true`), generated variant
 * (`template_product_id` set), and bundle/kit (`type=bundle`, exploded on sale
 * in Phase 3 — no `bundle_items` table yet).
 */
@Entity({ name: 'products', database: ErpDatabases.INVENTORY })
@Unique('uq_products_sku', ['sku'])
@Index('idx_products_item_group_id', ['item_group_id'])
@Index('idx_products_template_product_id', ['template_product_id'])
export class Product extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    comment: 'รหัสสินค้า — unique / SKU',
  })
  sku: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'ชื่อสินค้า (ไทย) / Product name (Thai)',
  })
  name_th: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'ชื่อสินค้า (อังกฤษ) / Product name (English)',
  })
  name_en: string;

  @Column({
    type: 'enum',
    enum: ProductType,
    comment: 'single | bundle (ชุด/kit)',
  })
  type: ProductType;

  @Column({ type: 'uuid', comment: 'กลุ่มสินค้า (leaf) / Item group ID' })
  item_group_id: string;

  @Column({ type: 'uuid', nullable: true, comment: 'ยี่ห้อ / Brand ID' })
  brand_id: string | null;

  @Column({
    type: 'uuid',
    comment:
      'หน่วยเก็บสต็อกหลัก — ล็อกไม่ให้แก้เมื่อมี movement / Stock UOM ID',
  })
  stock_uom_id: string;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'true = สินค้าต้นแบบ (template) ห้ามทำธุรกรรมตรง',
  })
  has_variants: boolean;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'ถ้าเป็น variant → อ้าง product ต้นแบบ / Template product ID',
  })
  template_product_id: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
    comment:
      'ผู้จัดซื้อหลัก (ref supplier-bc · UUID, ไม่มี FK ข้าม DB) / Supplier ID',
  })
  supplier_id: string | null;
}
