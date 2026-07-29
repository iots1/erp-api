import { Column, Entity, Unique } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

/**
 * One `{{key}}` placeholder definition — `PrintTemplatesService.render()`
 * substitutes every occurrence of `{{key}}` in `html_content` with the
 * caller-supplied value for `key`, falling back to `default_value`. Kept as
 * a plain interface (not the DTO class) so the entity never imports from
 * `dto/` — `PrintTemplateParameterDTO` mirrors this shape with validators.
 */
export interface IPrintTemplateParameter {
  key: string;
  label_th: string;
  label_en: string;
  default_value: string | null;
}

/**
 * Admin-managed HTML templates. The HTML body itself lives in MinIO/S3 (see
 * `PrintTemplatesService.uploadHtml`), not Postgres — only the object's
 * `html_bucket`/`html_path` are persisted here, keeping this table free of
 * large text blobs. `html_content` mirrors the entity property TypeORM
 * would generate for a real column, but carries no `@Column()` — it is
 * populated only by `PrintTemplatesService.findById()`, which fetches the
 * object's content from storage on read; TypeORM ignores it entirely for
 * both queries and writes.
 */
@Entity({ name: 'print_templates', database: ErpDatabases.REPORT })
@Unique('uq_print_templates_code', ['code'])
export class PrintTemplate extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 50,
    comment:
      'รหัสเทมเพลต ใช้อ้างอิงจากโค้ด (unique) / Template code, referenced by consumers',
  })
  code: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'ชื่อเทมเพลต (ไทย) / Template name (Thai)',
  })
  name_th: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: 'ชื่อเทมเพลต (อังกฤษ) / Template name (English)',
  })
  name_en: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'คำอธิบายเทมเพลต (ไทย) / Template description (Thai)',
  })
  description_th: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'คำอธิบายเทมเพลต (อังกฤษ) / Template description (English)',
  })
  description_en: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    comment:
      'บัคเก็ตที่เก็บไฟล์ HTML / Object storage bucket holding the HTML file',
  })
  html_bucket: string;

  @Column({
    type: 'varchar',
    length: 500,
    comment:
      'พาธของไฟล์ HTML ใน object storage / Object storage key/path of the HTML file',
  })
  html_path: string;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment:
      'SHA-256 ของ html_content ล่าสุดที่อัปโหลด (null = แถวเก่าก่อนมีคอลัมน์นี้ ยังไม่เคยคำนวณ) ใช้ข้ามการอัปโหลดซ้ำเมื่อเนื้อหาไม่เปลี่ยน / SHA-256 of the last-uploaded html_content (null = pre-existing row, not yet computed), used to skip re-uploading when content is unchanged',
  })
  html_hash: string | null;

  @Column({
    type: 'boolean',
    default: true,
    comment: 'สถานะใช้งาน / Is active',
  })
  is_active: boolean;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'A4',
    comment:
      'ขนาดกระดาษสำหรับ render PDF (A4/A5/Letter/Legal) / Paper size for PDF rendering',
  })
  paper_size: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'portrait',
    comment: 'แนวกระดาษ (portrait/landscape) / Paper orientation',
  })
  orientation: string;

  @Column({
    type: 'jsonb',
    default: () => "'[]'",
    comment:
      'รายการตัวแปร {{key}} สำหรับแทนที่ใน html_content ตอน render / {{key}} parameter definitions substituted at render time',
  })
  parameters: IPrintTemplateParameter[];

  /**
   * Not a DB column — populated on demand by `PrintTemplatesService.findById()`
   * from the object at `html_bucket`/`html_path`. Left `undefined` on every
   * other read path (list/paginated), which keeps those payloads small and
   * simply omits the key from the serialized JSON.
   */
  html_content?: string;
}
