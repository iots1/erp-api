import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrintTemplateJavascript1785676817728 implements MigrationInterface {
  name = 'AddPrintTemplateJavascript1785676817728';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "print_templates" ADD "js_bucket" character varying(255)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."js_bucket" IS 'บัคเก็ตที่เก็บไฟล์ JS ของเทมเพลตนี้โดยเฉพาะ (null = ไม่มี ใช้ paginator กลาง) / Object storage bucket holding this template''s own paginator JS (null = none, falls back to the shared paginator)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" ADD "js_path" character varying(500)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."js_path" IS 'พาธของไฟล์ JS ใน object storage / Object storage key/path of the JS file'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" ADD "js_hash" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."js_hash" IS 'SHA-256 ของ js_content ล่าสุดที่อัปโหลด ใช้ข้ามการอัปโหลดซ้ำเมื่อเนื้อหาไม่เปลี่ยน / SHA-256 of the last-uploaded js_content, used to skip re-uploading when content is unchanged'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."js_hash" IS 'SHA-256 ของ js_content ล่าสุดที่อัปโหลด ใช้ข้ามการอัปโหลดซ้ำเมื่อเนื้อหาไม่เปลี่ยน / SHA-256 of the last-uploaded js_content, used to skip re-uploading when content is unchanged'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" DROP COLUMN "js_hash"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."js_path" IS 'พาธของไฟล์ JS ใน object storage / Object storage key/path of the JS file'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" DROP COLUMN "js_path"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."js_bucket" IS 'บัคเก็ตที่เก็บไฟล์ JS ของเทมเพลตนี้โดยเฉพาะ (null = ไม่มี ใช้ paginator กลาง) / Object storage bucket holding this template''s own paginator JS (null = none, falls back to the shared paginator)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" DROP COLUMN "js_bucket"`,
    );
  }
}
