import * as bcrypt from 'bcrypt';
import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  SUPERADMIN_USER_ID,
  STAFF_USER_ID,
} from '../erp_iam/1784193117594-SeedIamMockupData';

/**
 * Credentials for the mockup users seeded into erp_iam by
 * `erp_iam/1784193117594-SeedIamMockupData.ts`.
 *
 * Credentials (erp_auth) and user profiles (erp_iam) live in different databases,
 * so a single migration cannot span both — these UUIDs are the only link and must
 * stay identical to the ones in the IAM seed. Login resolves username → credential
 * → `user_id`, then asks iam for that user and rejects the login unless it exists
 * and is `active`.
 *
 * Development mockup passwords — do not run this migration against production.
 */
const MOCKUP_USERS: Array<{
  user_id: string;
  username: string;
  password: string;
}> = [
  {
    user_id: SUPERADMIN_USER_ID,
    username: 'superadmin',
    password: 'ErpSuper26',
  },
  {
    user_id: STAFF_USER_ID,
    username: 'staff',
    password: 'ErpStaff26',
  },
];

/** Cost factor used by AuthService.setPassword — keep in sync so seeded hashes verify identically. */
const BCRYPT_ROUNDS = 10;

/**
 * Session/audit state is wiped alongside the credentials: leaving refresh tokens or
 * lockouts behind would point at users that no longer exist.
 */
const SEEDED_TABLES = [
  'refresh_tokens',
  'blocked_users',
  'login_histories',
  'security_logs',
  'credentials',
];

export class SeedAuthMockupData1784193120000 implements MigrationInterface {
  name = 'SeedAuthMockupData1784193120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE TABLE ${SEEDED_TABLES.join(', ')}`);

    for (const { user_id, username, password } of MOCKUP_USERS) {
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await queryRunner.query(
        `INSERT INTO credentials (user_id, username, password_hash, is_active)
         VALUES ($1, $2, $3, true)`,
        [user_id, username, passwordHash],
      );
    }
  }

  /**
   * Not a true inverse: `up()` truncates, so the pre-seed credentials are already
   * gone and cannot be restored. This returns auth to the empty state.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE TABLE ${SEEDED_TABLES.join(', ')}`);
  }
}
