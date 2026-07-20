import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `access_keys` (Access Key/Secret Key pairs for system-to-system HMAC
 * auth) and `access_keys_policies` (its policy attachments, mirroring
 * `roles_policies`).
 *
 * Trimmed by hand from the raw `migration:generate` output, which also
 * picked up unrelated pre-existing drift (redundant FK drop/recreate +
 * COMMENT churn on `policies`/`roles`/`users`/`statement_*`/`permissions`)
 * — noise from TypeORM's diff engine, not part of this change. See
 * `docs/plan-erp` backend-convention: "Review the generated SQL before
 * committing — the diff is a starting point, not gospel."
 */
export class CreateAccessKeys1784525659472 implements MigrationInterface {
  name = 'CreateAccessKeys1784525659472';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "access_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" uuid, "is_deleted" boolean NOT NULL DEFAULT false, "deleted_reason" text, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "access_key_id" character varying(20) NOT NULL, "secret_key_encrypted" text NOT NULL, "owner_id" uuid NOT NULL, "owner_type" character varying(20) NOT NULL, "name" character varying(100) NOT NULL, "description" text, "status" character varying(10) NOT NULL DEFAULT 'active', "last_used_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "metadata" jsonb, CONSTRAINT "PK_acdb83140f2654f870d92236303" PRIMARY KEY ("id")); COMMENT ON COLUMN "access_keys"."id" IS 'รหัสอ้างอิงหลัก'; COMMENT ON COLUMN "access_keys"."created_at" IS 'วันที่สร้าง (system)'; COMMENT ON COLUMN "access_keys"."created_by" IS 'ผู้บันทึก'; COMMENT ON COLUMN "access_keys"."updated_at" IS 'วันที่แก้ไขล่าสุด'; COMMENT ON COLUMN "access_keys"."updated_by" IS 'ผู้แก้ไขล่าสุด'; COMMENT ON COLUMN "access_keys"."is_deleted" IS 'สถานะการลบ'; COMMENT ON COLUMN "access_keys"."deleted_reason" IS 'เหตุผลที่ลบข้อมูล'; COMMENT ON COLUMN "access_keys"."deleted_at" IS 'วันที่ลบ'; COMMENT ON COLUMN "access_keys"."deleted_by" IS 'ผู้ลบ'; COMMENT ON COLUMN "access_keys"."access_key_id" IS 'Public identifier — AKIA + 16 ตัวอักษร A-Z0-9 (unique เฉพาะแถวที่ยังไม่ถูกลบ) — uq_access_keys_access_key_id'; COMMENT ON COLUMN "access_keys"."secret_key_encrypted" IS 'Secret key เข้ารหัสด้วย AES-256-GCM (iv:authTag:ciphertext, base64) — ไม่ถูก select โดย default'; COMMENT ON COLUMN "access_keys"."owner_id" IS 'อ้างอิง owner (iam.users.id หรือ service account id)'; COMMENT ON COLUMN "access_keys"."owner_type" IS 'ประเภทของ owner — ENUM(''user'', ''service_account'')'; COMMENT ON COLUMN "access_keys"."name" IS 'ชื่อ access key เช่น Warehouse-Integration'; COMMENT ON COLUMN "access_keys"."description" IS 'รายละเอียดการใช้งาน'; COMMENT ON COLUMN "access_keys"."status" IS 'สถานะ — ENUM(''active'', ''inactive'', ''revoked'')'; COMMENT ON COLUMN "access_keys"."last_used_at" IS 'ใช้งานล่าสุดเมื่อ'; COMMENT ON COLUMN "access_keys"."expires_at" IS 'วันหมดอายุ — NULL = ไม่มีวันหมดอายุ'; COMMENT ON COLUMN "access_keys"."metadata" IS 'ข้อมูลเพิ่มเติม เช่น { ip_whitelist: ["192.168.1.0"] }'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_access_keys_access_key_id" ON "access_keys" ("access_key_id") WHERE is_deleted = false`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "access_keys" IS 'Access Key/Secret Key คู่สำหรับ authenticate แบบ system-to-system (HMAC signature) — ผูกสิทธิ์ผ่าน access_keys_policies'`,
    );
    await queryRunner.query(
      `CREATE TABLE "access_keys_policies" ("access_key_id" uuid NOT NULL, "policy_id" uuid NOT NULL, CONSTRAINT "PK_caba4935bd8b62016d4b990655a" PRIMARY KEY ("access_key_id", "policy_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_347e60f17c6ef4f72bbbeea940" ON "access_keys_policies" ("access_key_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4a9495d1dd6f6eb49535956106" ON "access_keys_policies" ("policy_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "access_keys_policies" ADD CONSTRAINT "fk_access_keys_policies_access_key_id" FOREIGN KEY ("access_key_id") REFERENCES "access_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_keys_policies" ADD CONSTRAINT "fk_access_keys_policies_policy_id" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_keys_policies" DROP CONSTRAINT "fk_access_keys_policies_policy_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_keys_policies" DROP CONSTRAINT "fk_access_keys_policies_access_key_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4a9495d1dd6f6eb49535956106"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_347e60f17c6ef4f72bbbeea940"`,
    );
    await queryRunner.query(`DROP TABLE "access_keys_policies"`);
    await queryRunner.query(`COMMENT ON TABLE "access_keys" IS NULL`);
    await queryRunner.query(
      `DROP INDEX "public"."uq_access_keys_access_key_id"`,
    );
    await queryRunner.query(`DROP TABLE "access_keys"`);
  }
}
