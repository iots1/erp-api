import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the append-only audit tables that replace the id/created_by/updated_at
 * that role_policies/user_roles lost when they became plain @ManyToMany join
 * tables (see SimplifyRolePoliciesUserRolesJoinTables) — one row per
 * attach/detach, written by RolesService.attachPolicies /
 * UsersService.assignRoles. No FK to roles/policies/users: an audit trail
 * must survive the referenced row being deleted, not cascade away with it.
 */
export class AddRolePolicyAndUserRoleAuditLogs1784482416983 implements MigrationInterface {
  name = 'AddRolePolicyAndUserRoleAuditLogs1784482416983';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "role_policy_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "deleted_reason" text,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        "role_id" uuid NOT NULL,
        "policy_id" uuid NOT NULL,
        "action" character varying(10) NOT NULL,
        CONSTRAINT "chk_role_policy_audit_logs_action" CHECK ("action" IN ('attached', 'detached')),
        CONSTRAINT "PK_52fc9b3a90aa78e655517d1fedd" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_role_policy_audit_logs_role_id" ON "role_policy_audit_logs" ("role_id")`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "role_policy_audit_logs" IS 'ประวัติการ attach/detach policy เข้า/ออกจาก role (created_at/created_by = เวลา/ผู้กระทำ)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."id" IS 'รหัสอ้างอิงหลัก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."created_at" IS 'วันที่สร้าง (system)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."created_by" IS 'ผู้บันทึก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."updated_at" IS 'วันที่แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."updated_by" IS 'ผู้แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."is_deleted" IS 'สถานะการลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."deleted_reason" IS 'เหตุผลที่ลบข้อมูล'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."deleted_at" IS 'วันที่ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."deleted_by" IS 'ผู้ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."role_id" IS 'อ้างอิง roles.id (ไม่ผูก FK)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."policy_id" IS 'อ้างอิง policies.id (ไม่ผูก FK)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "role_policy_audit_logs"."action" IS 'attached | detached'`,
    );

    await queryRunner.query(`
      CREATE TABLE "user_role_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by" uuid,
        "is_deleted" boolean NOT NULL DEFAULT false,
        "deleted_reason" text,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        "user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "action" character varying(10) NOT NULL,
        CONSTRAINT "chk_user_role_audit_logs_action" CHECK ("action" IN ('attached', 'detached')),
        CONSTRAINT "PK_bcb726773902de94384b3faf508" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_user_role_audit_logs_user_id" ON "user_role_audit_logs" ("user_id")`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "user_role_audit_logs" IS 'ประวัติการ assign/revoke role ให้/จาก user (created_at/created_by = เวลา/ผู้กระทำ)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."id" IS 'รหัสอ้างอิงหลัก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."created_at" IS 'วันที่สร้าง (system)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."created_by" IS 'ผู้บันทึก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."updated_at" IS 'วันที่แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."updated_by" IS 'ผู้แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."is_deleted" IS 'สถานะการลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."deleted_reason" IS 'เหตุผลที่ลบข้อมูล'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."deleted_at" IS 'วันที่ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."deleted_by" IS 'ผู้ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."user_id" IS 'อ้างอิง users.id (ไม่ผูก FK)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."role_id" IS 'อ้างอิง roles.id (ไม่ผูก FK)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "user_role_audit_logs"."action" IS 'attached | detached'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_role_audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_policy_audit_logs"`);
  }
}
