import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { DocumentType } from './document-type.entity';

/**
 * Current running-number counter state for a document type — one row per
 * `document_type_id` (enforced unique), upserted by
 * `DocumentTypesService.generateNextRunningNumber()`. `last_value` (the full
 * formatted string, not just the digits) is what gets regex-tested against
 * the document type's *current* `running_number_format` on the next
 * generation: a match continues the sequence, a mismatch (format edited, or
 * a date-based token like {YYYY}/{MM} rolled over) resets it to 1.
 */
@Entity({ name: 'document_running_numbers', database: ErpDatabases.REPORT })
@Unique('uq_document_running_numbers_document_type_id', ['document_type_id'])
export class DocumentRunningNumber extends BaseEntity {
  @Column({
    type: 'uuid',
    comment: 'อ้างอิง document_types.id (1 แถวต่อ 1 ประเภทเอกสาร)',
  })
  document_type_id: string;

  @ManyToOne(() => DocumentType, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'document_type_id',
    foreignKeyConstraintName: 'fk_document_running_numbers_document_type_id',
  })
  document_type: DocumentType;

  @Column({
    type: 'int',
    default: 0,
    comment: 'เลขรันล่าสุดที่ออกไป / Last issued running number (digits only)',
  })
  last_running_number: number;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'เลขที่เอกสารเต็มล่าสุดที่ออกไป ใช้ตรวจสอบ pattern ตอนออกเลขถัดไป / Last issued full document number',
  })
  last_value: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
    comment: 'เวลาที่ออกเลขล่าสุด / When the last number was issued',
  })
  last_issued_at: Date | null;
}
