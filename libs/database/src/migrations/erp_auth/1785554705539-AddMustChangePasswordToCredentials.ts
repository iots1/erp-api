import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMustChangePasswordToCredentials1785554705539 implements MigrationInterface {
  name = 'AddMustChangePasswordToCredentials1785554705539';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON TABLE "security_logs" IS 'audit เชิงความปลอดภัย (เปลี่ยนรหัส, สิทธิ์, login/logout, block)'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "refresh_tokens" IS 'ต่ออายุ session · เพิกถอนได้'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "credentials" IS 'เก็บรหัสผ่าน (hash) แยกจากข้อมูลผู้ใช้ — user_id อ้างอิง iam.users ด้วย UUID'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "login_histories" IS 'ประวัติเข้าใช้งาน (สำเร็จ/ล้มเหลว)'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "blocked_users" IS 'ล็อกบัญชี (เช่น ใส่รหัสผิดเกินกำหนด)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "credentials" ADD "must_change_password" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."must_change_password" IS 'บังคับให้ผู้ใช้ตั้งรหัสผ่านใหม่ในการ login ครั้งถัดไป (เช่น หลังสร้างบัญชีด้วยรหัสผ่านสุ่ม)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."id" IS 'รหัสอ้างอิงหลัก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."created_at" IS 'วันที่สร้าง (system)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."created_by" IS 'ผู้บันทึก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."updated_at" IS 'วันที่แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."updated_by" IS 'ผู้แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."is_deleted" IS 'สถานะการลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."deleted_reason" IS 'เหตุผลที่ลบข้อมูล'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."deleted_at" IS 'วันที่ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."deleted_by" IS 'ผู้ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."event_type" IS 'ประเภทเหตุการณ์ เช่น login_success, login_failed, logout, password_set, account_blocked'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."user_id" IS 'อ้างอิง iam.users.id'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."ip_address" IS 'IP address'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."detail" IS 'รายละเอียดเพิ่มเติม'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."id" IS 'รหัสอ้างอิงหลัก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."created_at" IS 'วันที่สร้าง (system)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."created_by" IS 'ผู้บันทึก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."updated_at" IS 'วันที่แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."updated_by" IS 'ผู้แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."is_deleted" IS 'สถานะการลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."deleted_reason" IS 'เหตุผลที่ลบข้อมูล'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."deleted_at" IS 'วันที่ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."deleted_by" IS 'ผู้ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."user_id" IS 'อ้างอิง iam.users.id'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."token_hash" IS 'sha256 hash ของ refresh token — uq_refresh_tokens_token_hash'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."expires_at" IS 'วันหมดอายุ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."revoked_at" IS 'วันที่เพิกถอน (ถ้ามี)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."id" IS 'รหัสอ้างอิงหลัก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."created_at" IS 'วันที่สร้าง (system)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."created_by" IS 'ผู้บันทึก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."updated_at" IS 'วันที่แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."updated_by" IS 'ผู้แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."is_deleted" IS 'สถานะการลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."deleted_reason" IS 'เหตุผลที่ลบข้อมูล'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."deleted_at" IS 'วันที่ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."deleted_by" IS 'ผู้ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."user_id" IS 'อ้างอิง iam.users.id (ข้าม BC ด้วย UUID)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."username" IS 'ชื่อผู้ใช้ (สำเนาจาก iam เพื่อ lookup เร็ว, unique เฉพาะแถวที่ยังไม่ถูกลบ) — uq_credentials_username'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."password_hash" IS 'รหัสผ่าน (bcrypt hash)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."is_active" IS 'สถานะใช้งาน credential นี้'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."id" IS 'รหัสอ้างอิงหลัก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."created_at" IS 'วันที่สร้าง (system)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."created_by" IS 'ผู้บันทึก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."updated_at" IS 'วันที่แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."updated_by" IS 'ผู้แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."is_deleted" IS 'สถานะการลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."deleted_reason" IS 'เหตุผลที่ลบข้อมูล'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."deleted_at" IS 'วันที่ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."deleted_by" IS 'ผู้ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."user_id" IS 'อ้างอิง iam.users.id (null ถ้า username ไม่พบ)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."username" IS 'username ที่ใช้ล็อกอิน'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."ip_address" IS 'IP address'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."user_agent" IS 'User agent'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."is_success" IS 'สำเร็จหรือไม่'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."logged_in_at" IS 'เวลาที่เข้าใช้งาน'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."id" IS 'รหัสอ้างอิงหลัก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."created_at" IS 'วันที่สร้าง (system)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."created_by" IS 'ผู้บันทึก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."updated_at" IS 'วันที่แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."updated_by" IS 'ผู้แก้ไขล่าสุด'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."is_deleted" IS 'สถานะการลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."deleted_reason" IS 'เหตุผลที่ลบข้อมูล'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."deleted_at" IS 'วันที่ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."deleted_by" IS 'ผู้ลบ'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."user_id" IS 'อ้างอิง iam.users.id'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."reason" IS 'เหตุผลที่บล็อก'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."blocked_until" IS 'บล็อกจนถึงเมื่อไร (null = ไม่มีกำหนด)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."blocked_by" IS 'ผู้ที่ทำการบล็อก (null = ระบบ auto-lock)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."blocked_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."blocked_until" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."reason" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."user_id" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."deleted_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."deleted_reason" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."is_deleted" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."updated_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."updated_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."created_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "blocked_users"."created_at" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "blocked_users"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."logged_in_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."is_success" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."user_agent" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."ip_address" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."username" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."user_id" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."deleted_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."deleted_reason" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."is_deleted" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."updated_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."updated_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."created_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "login_histories"."created_at" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "login_histories"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."is_active" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."password_hash" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."username" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."user_id" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."deleted_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."deleted_reason" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."is_deleted" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."updated_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."updated_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."created_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."created_at" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "credentials"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."revoked_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."expires_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."token_hash" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."user_id" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."deleted_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."deleted_reason" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."is_deleted" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."updated_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."updated_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."created_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "refresh_tokens"."created_at" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "refresh_tokens"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."detail" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."ip_address" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."user_id" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."event_type" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."deleted_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."deleted_reason" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."is_deleted" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."updated_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."updated_at" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."created_by" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "security_logs"."created_at" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "security_logs"."id" IS NULL`);
    await queryRunner.query(
      `COMMENT ON COLUMN "credentials"."must_change_password" IS 'บังคับให้ผู้ใช้ตั้งรหัสผ่านใหม่ในการ login ครั้งถัดไป (เช่น หลังสร้างบัญชีด้วยรหัสผ่านสุ่ม)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "credentials" DROP COLUMN "must_change_password"`,
    );
    await queryRunner.query(`COMMENT ON TABLE "blocked_users" IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE "login_histories" IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE "credentials" IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE "refresh_tokens" IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE "security_logs" IS NULL`);
  }
}
