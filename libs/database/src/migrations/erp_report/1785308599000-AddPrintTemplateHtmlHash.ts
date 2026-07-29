import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrintTemplateHtmlHash1785308599000 implements MigrationInterface {
  name = 'AddPrintTemplateHtmlHash1785308599000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "print_templates" ADD "html_hash" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."html_hash" IS 'SHA-256 ของ html_content ล่าสุดที่อัปโหลด (null = แถวเก่าก่อนมีคอลัมน์นี้ ยังไม่เคยคำนวณ) ใช้ข้ามการอัปโหลดซ้ำเมื่อเนื้อหาไม่เปลี่ยน / SHA-256 of the last-uploaded html_content (null = pre-existing row, not yet computed), used to skip re-uploading when content is unchanged'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."html_hash" IS 'SHA-256 ของ html_content ล่าสุดที่อัปโหลด (null = แถวเก่าก่อนมีคอลัมน์นี้ ยังไม่เคยคำนวณ) ใช้ข้ามการอัปโหลดซ้ำเมื่อเนื้อหาไม่เปลี่ยน / SHA-256 of the last-uploaded html_content (null = pre-existing row, not yet computed), used to skip re-uploading when content is unchanged'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" DROP COLUMN "html_hash"`,
    );
  }
}
