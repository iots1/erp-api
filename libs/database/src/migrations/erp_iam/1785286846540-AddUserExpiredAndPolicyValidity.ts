import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserExpiredAndPolicyValidity1785286846540
  implements MigrationInterface
{
  name = 'AddUserExpiredAndPolicyValidity1785286846540';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "expired_at" date`);
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."expired_at" IS 'วันหมดอายุบัญชี — null = ไม่จำกัดเวลา'`,
    );
    await queryRunner.query(`ALTER TABLE "policies" ADD "valid_from" date`);
    await queryRunner.query(
      `COMMENT ON COLUMN "policies"."valid_from" IS 'ใช้งานได้ตั้งแต่วันที่ — null = ไม่จำกัด'`,
    );
    await queryRunner.query(`ALTER TABLE "policies" ADD "valid_until" date`);
    await queryRunner.query(
      `COMMENT ON COLUMN "policies"."valid_until" IS 'ใช้งานได้ถึงวันที่ — null = ไม่จำกัด'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "policies" DROP COLUMN "valid_until"`);
    await queryRunner.query(`ALTER TABLE "policies" DROP COLUMN "valid_from"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "expired_at"`);
  }
}
