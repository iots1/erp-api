import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { PrintTemplate } from '../../print-template/entities/print-template.entity';

/**
 * Defines a kind of document (invoice, receipt, purchase order, ...): which
 * print template renders it, and whether/how it gets a running number.
 * `print_template_id` is a real Postgres FK — both tables live in
 * `erp_report`, so (unlike a cross-BC reference) this doesn't violate the
 * database-per-context rule.
 */
@Entity({ name: 'document_types', database: ErpDatabases.REPORT })
@Unique('uq_document_types_code', ['code'])
export class DocumentType extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 50,
    comment: 'รหัสประเภทเอกสาร (unique) / Document type code',
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'ชื่อประเภทเอกสาร (ไทย) / Document type name (Thai)',
  })
  name_th: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'ชื่อประเภทเอกสาร (อังกฤษ) / Document type name (English)',
  })
  name_en: string;

  @Column({
    type: 'uuid',
    comment: 'อ้างอิง print_templates.id ที่ใช้ render เอกสารประเภทนี้',
  })
  print_template_id: string;

  @ManyToOne(() => PrintTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'print_template_id',
    foreignKeyConstraintName: 'fk_document_types_print_template_id',
  })
  print_template: PrintTemplate;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'เอกสารประเภทนี้มีเลขที่รันอัตโนมัติหรือไม่ / Whether this document type uses a running number',
  })
  has_running_number: boolean;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment:
      'รูปแบบเลขที่เอกสาร ใช้ {YYYY}/{YY}/{MM}/{DD}/{SEQ:n} เช่น INV-{YYYY}{MM}-{SEQ:5} — บังคับเมื่อ has_running_number = true / Running number format pattern',
  })
  running_number_format: string | null;

  @Column({
    type: 'boolean',
    default: true,
    comment: 'สถานะใช้งาน / Is active',
  })
  is_active: boolean;
}
