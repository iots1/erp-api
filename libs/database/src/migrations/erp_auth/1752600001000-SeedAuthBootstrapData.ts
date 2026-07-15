import * as bcrypt from 'bcrypt';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Must match the bootstrap admin user id seeded in erp_iam. Default password: Admin@12345 (change after first login). */
const BOOTSTRAP_ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';
const BOOTSTRAP_ADMIN_PASSWORD = 'Admin@12345';

export class SeedAuthBootstrapData1752600001000 implements MigrationInterface {
  name = 'SeedAuthBootstrapData1752600001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const passwordHash = await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 10);

    await queryRunner.query(
      `INSERT INTO credentials (user_id, username, password_hash, is_active)
       VALUES ($1, 'admin', $2, true)`,
      [BOOTSTRAP_ADMIN_USER_ID, passwordHash],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM credentials WHERE user_id = $1`, [
      BOOTSTRAP_ADMIN_USER_ID,
    ]);
  }
}
