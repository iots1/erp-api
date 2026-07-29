import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrintTemplates1785291567002 implements MigrationInterface {
  name = 'CreatePrintTemplates1785291567002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "print_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "is_deleted" boolean NOT NULL DEFAULT false, "deleted_reason" text, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "code" character varying(50) NOT NULL, "name_th" character varying(255) NOT NULL, "name_en" character varying(255) NOT NULL, "description_th" text, "description_en" text, "html_bucket" character varying(255) NOT NULL, "html_path" character varying(500) NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "uq_print_templates_code" UNIQUE ("code"), CONSTRAINT "PK_b163520d7ca8225637773ea4451" PRIMARY KEY ("id")); COMMENT ON COLUMN "print_templates"."id" IS 'รหัสอ้างอิงหลัก'; COMMENT ON COLUMN "print_templates"."created_at" IS 'วันที่สร้าง (system)'; COMMENT ON COLUMN "print_templates"."created_by" IS 'ผู้บันทึก'; COMMENT ON COLUMN "print_templates"."updated_at" IS 'วันที่แก้ไขล่าสุด'; COMMENT ON COLUMN "print_templates"."updated_by" IS 'ผู้แก้ไขล่าสุด'; COMMENT ON COLUMN "print_templates"."is_deleted" IS 'สถานะการลบ'; COMMENT ON COLUMN "print_templates"."deleted_reason" IS 'เหตุผลที่ลบข้อมูล'; COMMENT ON COLUMN "print_templates"."deleted_at" IS 'วันที่ลบ'; COMMENT ON COLUMN "print_templates"."deleted_by" IS 'ผู้ลบ'; COMMENT ON COLUMN "print_templates"."code" IS 'รหัสเทมเพลต ใช้อ้างอิงจากโค้ด (unique) / Template code, referenced by consumers'; COMMENT ON COLUMN "print_templates"."name_th" IS 'ชื่อเทมเพลต (ไทย) / Template name (Thai)'; COMMENT ON COLUMN "print_templates"."name_en" IS 'ชื่อเทมเพลต (อังกฤษ) / Template name (English)'; COMMENT ON COLUMN "print_templates"."description_th" IS 'คำอธิบายเทมเพลต (ไทย) / Template description (Thai)'; COMMENT ON COLUMN "print_templates"."description_en" IS 'คำอธิบายเทมเพลต (อังกฤษ) / Template description (English)'; COMMENT ON COLUMN "print_templates"."html_bucket" IS 'บัคเก็ตที่เก็บไฟล์ HTML / Object storage bucket holding the HTML file'; COMMENT ON COLUMN "print_templates"."html_path" IS 'พาธของไฟล์ HTML ใน object storage / Object storage key/path of the HTML file'; COMMENT ON COLUMN "print_templates"."is_active" IS 'สถานะใช้งาน / Is active'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "print_templates"`);
  }
}
