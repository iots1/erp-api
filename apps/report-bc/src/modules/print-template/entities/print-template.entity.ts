import { Column, Entity, Unique } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

/** Field of one `type: 'array'` parameter's items — lets the admin form build
 * a test-data row without knowing the band template's exact `{{row.*}}` keys. */
export interface IPrintTemplateParameterField {
  key: string;
  label_th: string;
  label_en: string;
  /** One of `PRINT_TEMPLATE_PARAMETER_TYPES` (constants/print-template.constants.ts)
   * — plain `string` here, validated only via the DTO's `@IsIn()`, same as
   * how `paper_size`/`orientation` are handled below. */
  type: string;
}

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
  /** Optional — defaults to `'string'` at the usage site (rows written
   * before this field existed, and the DTO itself, both omit it). */
  type?: string;
  default_value: string | null;
  /** Only for `type: 'array'` — shape of each item, e.g. the `row` in a
   * `<template data-repeat="items">{{row.description}}</template>` band. */
  item_schema?: IPrintTemplateParameterField[];
}

/** Layout tuning for the `'banded'` engine — every field optional, the
 * paginator falls back to measuring available space itself when omitted. */
export interface IPrintTemplateLayoutConfig {
  detail_height_mm?: number;
  reserve_summary_mm?: number;
  margin_mm?: { top?: number; bottom?: number; left?: number; right?: number };
}

/**
 * Admin-managed HTML templates. The HTML body itself lives in MinIO/S3 (see
 * `PrintTemplatesService.uploadTemplateAsset`), not Postgres — only the object's
 * `html_bucket`/`html_path` are persisted here, keeping this table free of
 * large text blobs. `html_content` mirrors the entity property TypeORM
 * would generate for a real column, but carries no `@Column()` — it is
 * populated only by `PrintTemplatesService.findById()`, which fetches the
 * object's content from storage on read; TypeORM ignores it entirely for
 * both queries and writes. Both objects (and any future per-template asset)
 * live under the same `reports/print-templates/<id>/` storage folder — see
 * `PrintTemplatesService.templateStorageKey()`. `js_bucket`/`js_path` follow
 * the identical pattern for an optional per-template paginator override.
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

  /**
   * Optional per-template paginator override for the `'banded'` engine —
   * when set, `BandedRenderService` injects this instead of the shared
   * `assets/paginator.inline.js`, so a document whose pagination rules
   * differ (different page-break conditions, extra bands, etc.) isn't
   * forced onto the one generic script every other template shares. Null
   * for every template that has no override, which is the common case.
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    comment:
      "บัคเก็ตที่เก็บไฟล์ JS ของเทมเพลตนี้โดยเฉพาะ (null = ไม่มี ใช้ paginator กลาง) / Object storage bucket holding this template's own paginator JS (null = none, falls back to the shared paginator)",
  })
  js_bucket: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true,
    comment:
      'พาธของไฟล์ JS ใน object storage / Object storage key/path of the JS file',
  })
  js_path: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment:
      'SHA-256 ของ js_content ล่าสุดที่อัปโหลด ใช้ข้ามการอัปโหลดซ้ำเมื่อเนื้อหาไม่เปลี่ยน / SHA-256 of the last-uploaded js_content, used to skip re-uploading when content is unchanged',
  })
  js_hash: string | null;

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
   * `'simple'` (default, backward compatible) — `html_content` is one flat
   * document; `{{key}}` gets a plain string substitution, no pagination.
   * `'banded'` — `html_content` declares `<template data-band="...">` blocks
   * (page-header/detail-header/detail-row/filler-row/summary/page-footer);
   * the in-page paginator measures real row heights and splits into
   * physical pages itself. See reviews/print-template-pagination-2026-07-29.md.
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'simple',
    comment:
      "เอนจินสร้าง PDF: 'simple' = แทนที่ {{key}} ตรงๆ ไม่มีการแบ่งหน้า (ของเดิม), 'banded' = แบ่งหน้าอัตโนมัติจาก band template / PDF rendering engine",
  })
  template_engine: string;

  @Column({
    type: 'jsonb',
    default: () => "'{}'",
    comment:
      'ค่าตั้งค่าเลย์เอาต์สำหรับ engine banded เท่านั้น (ความสูง detail band, พื้นที่กันไว้ให้ summary, margin) / Layout tuning, only meaningful when template_engine=banded',
  })
  layout_config: IPrintTemplateLayoutConfig;

  @Column({
    type: 'varchar',
    length: 10,
    default: 'print',
    comment:
      "CSS media type ที่ Gotenberg ใช้ตอน render ('print'/'screen') ส่งต่อเป็น emulatedMediaType — ปกติใช้ 'print' (default ของ Chromium และจำเป็นสำหรับ thead/tfoot ซ้ำทุกหน้า) / Gotenberg emulatedMediaType override per template",
  })
  emulated_media_type: string;

  /**
   * Sample render data the admin form's live preview and "Generate Test
   * PDF" send as `params` — for `template_engine = 'simple'` this is a flat
   * `{key: string}` map matching `parameters[].key`; for `'banded'` it's
   * whatever nested shape the band template's `{{path}}`/`data-repeat`
   * placeholders expect (see `PrintTemplateRenderParams`). Never used by the
   * real `render()` call a document-generation caller makes — that always
   * supplies its own `params` — this only seeds the editor.
   */
  @Column({
    type: 'jsonb',
    default: () => "'{}'",
    comment:
      "ตัวอย่างข้อมูลสำหรับ preview/Generate Test PDF ในหน้า admin เท่านั้น ไม่เกี่ยวกับ render จริง / Sample params the admin form's preview and test-render use — unrelated to a real caller's render()",
  })
  mock_data: Record<string, unknown>;

  /**
   * Not a DB column — populated on demand by `PrintTemplatesService.findById()`
   * from the object at `html_bucket`/`html_path`. Left `undefined` on every
   * other read path (list/paginated), which keeps those payloads small and
   * simply omits the key from the serialized JSON.
   */
  html_content?: string;

  /**
   * Not a DB column — mirrors `html_content`, populated from `js_bucket`/
   * `js_path` when set. `null` (not `undefined`) once hydrated by
   * `findById()` for a template with no override, so the admin form can
   * tell "no custom JS" apart from "not loaded yet".
   */
  js_content?: string | null;
}
