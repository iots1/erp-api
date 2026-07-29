import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrintTemplatePaperSizeAndParameters1785296544931 implements MigrationInterface {
    name = 'AddPrintTemplatePaperSizeAndParameters1785296544931'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "print_templates" ADD "paper_size" character varying(20) NOT NULL DEFAULT 'A4'`);
        await queryRunner.query(`COMMENT ON COLUMN "print_templates"."paper_size" IS 'ขนาดกระดาษสำหรับ render PDF (A4/A5/Letter/Legal) / Paper size for PDF rendering'`);
        await queryRunner.query(`ALTER TABLE "print_templates" ADD "orientation" character varying(20) NOT NULL DEFAULT 'portrait'`);
        await queryRunner.query(`COMMENT ON COLUMN "print_templates"."orientation" IS 'แนวกระดาษ (portrait/landscape) / Paper orientation'`);
        await queryRunner.query(`ALTER TABLE "print_templates" ADD "parameters" jsonb NOT NULL DEFAULT '[]'`);
        await queryRunner.query(`COMMENT ON COLUMN "print_templates"."parameters" IS 'รายการตัวแปร {{key}} สำหรับแทนที่ใน html_content ตอน render / {{key}} parameter definitions substituted at render time'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`COMMENT ON COLUMN "print_templates"."parameters" IS 'รายการตัวแปร {{key}} สำหรับแทนที่ใน html_content ตอน render / {{key}} parameter definitions substituted at render time'`);
        await queryRunner.query(`ALTER TABLE "print_templates" DROP COLUMN "parameters"`);
        await queryRunner.query(`COMMENT ON COLUMN "print_templates"."orientation" IS 'แนวกระดาษ (portrait/landscape) / Paper orientation'`);
        await queryRunner.query(`ALTER TABLE "print_templates" DROP COLUMN "orientation"`);
        await queryRunner.query(`COMMENT ON COLUMN "print_templates"."paper_size" IS 'ขนาดกระดาษสำหรับ render PDF (A4/A5/Letter/Legal) / Paper size for PDF rendering'`);
        await queryRunner.query(`ALTER TABLE "print_templates" DROP COLUMN "paper_size"`);
    }

}
