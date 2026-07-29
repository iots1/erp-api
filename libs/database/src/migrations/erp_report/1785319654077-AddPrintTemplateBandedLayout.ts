import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrintTemplateBandedLayout1785319654077 implements MigrationInterface {
  name = 'AddPrintTemplateBandedLayout1785319654077';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "print_templates" ADD "template_engine" character varying(20) NOT NULL DEFAULT 'simple'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."template_engine" IS 'เอนจินสร้าง PDF: ''simple'' = แทนที่ {{key}} ตรงๆ ไม่มีการแบ่งหน้า (ของเดิม), ''banded'' = แบ่งหน้าอัตโนมัติจาก band template / PDF rendering engine'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" ADD "layout_config" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."layout_config" IS 'ค่าตั้งค่าเลย์เอาต์สำหรับ engine banded เท่านั้น (ความสูง detail band, พื้นที่กันไว้ให้ summary, margin) / Layout tuning, only meaningful when template_engine=banded'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" ADD "emulated_media_type" character varying(10) NOT NULL DEFAULT 'print'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."emulated_media_type" IS 'CSS media type ที่ Gotenberg ใช้ตอน render (''print''/''screen'') ส่งต่อเป็น emulatedMediaType — ปกติใช้ ''print'' (default ของ Chromium และจำเป็นสำหรับ thead/tfoot ซ้ำทุกหน้า) / Gotenberg emulatedMediaType override per template'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."emulated_media_type" IS 'CSS media type ที่ Gotenberg ใช้ตอน render (''print''/''screen'') ส่งต่อเป็น emulatedMediaType — ปกติใช้ ''print'' (default ของ Chromium และจำเป็นสำหรับ thead/tfoot ซ้ำทุกหน้า) / Gotenberg emulatedMediaType override per template'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" DROP COLUMN "emulated_media_type"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."layout_config" IS 'ค่าตั้งค่าเลย์เอาต์สำหรับ engine banded เท่านั้น (ความสูง detail band, พื้นที่กันไว้ให้ summary, margin) / Layout tuning, only meaningful when template_engine=banded'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" DROP COLUMN "layout_config"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."template_engine" IS 'เอนจินสร้าง PDF: ''simple'' = แทนที่ {{key}} ตรงๆ ไม่มีการแบ่งหน้า (ของเดิม), ''banded'' = แบ่งหน้าอัตโนมัติจาก band template / PDF rendering engine'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" DROP COLUMN "template_engine"`,
    );
  }
}
