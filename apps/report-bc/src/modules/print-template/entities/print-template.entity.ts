import { Column, Entity, Unique } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

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
    type: 'boolean',
    default: true,
    comment: 'สถานะใช้งาน / Is active',
  })
  is_active: boolean;

  /**
   * Not a DB column — populated on demand by `PrintTemplatesService.findById()`
   * from the object at `html_bucket`/`html_path`. Left `undefined` on every
   * other read path (list/paginated), which keeps those payloads small and
   * simply omits the key from the serialized JSON.
   */
  html_content?: string;
}
