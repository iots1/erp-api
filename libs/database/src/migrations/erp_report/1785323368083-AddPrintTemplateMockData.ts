import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrintTemplateMockData1785323368083 implements MigrationInterface {
  name = 'AddPrintTemplateMockData1785323368083';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "print_templates" ADD "mock_data" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."mock_data" IS 'ตัวอย่างข้อมูลสำหรับ preview/Generate Test PDF ในหน้า admin เท่านั้น ไม่เกี่ยวกับ render จริง / Sample params the admin form''s preview and test-render use — unrelated to a real caller''s render()'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "print_templates"."mock_data" IS 'ตัวอย่างข้อมูลสำหรับ preview/Generate Test PDF ในหน้า admin เท่านั้น ไม่เกี่ยวกับ render จริง / Sample params the admin form''s preview and test-render use — unrelated to a real caller''s render()'`,
    );
    await queryRunner.query(
      `ALTER TABLE "print_templates" DROP COLUMN "mock_data"`,
    );
  }
}
