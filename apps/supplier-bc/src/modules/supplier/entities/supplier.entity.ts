import { Column, Entity, Unique } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

/**
 * Supplier master data (supplier-bc owns this table). Other BCs reference a
 * supplier only by `supplier_id` (UUID) — never a cross-database FK — per the
 * "database-per-context" architecture rule.
 */
@Entity({ name: 'suppliers', database: ErpDatabases.SUPPLIER })
@Unique('uq_suppliers_code', ['code'])
export class Supplier extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 50,
    comment: 'รหัสผู้จัดซื้อ / Supplier code',
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'ชื่อผู้จัดซื้อ (ไทย) / Supplier name (Thai)',
  })
  name_th: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'ชื่อผู้จัดซื้อ (อังกฤษ) / Supplier name (English)',
  })
  name_en: string;

  @Column({
    type: 'varchar',
    length: 20,
    comment: 'เลขประจำตัวผู้เสียภาษี / Tax ID',
  })
  tax_id: string;

  @Column({
    type: 'varchar',
    length: 30,
    nullable: true,
    comment: 'เบอร์โทรติดต่อ / Contact phone',
  })
  contact_phone: string | null;

  @Column({ type: 'text', nullable: true, comment: 'ที่อยู่ / Address' })
  address: string | null;

  @Column({
    type: 'int',
    nullable: true,
    comment: 'เงื่อนไขเครดิต (วัน) / Credit terms (days)',
  })
  credit_terms: number | null;
}
