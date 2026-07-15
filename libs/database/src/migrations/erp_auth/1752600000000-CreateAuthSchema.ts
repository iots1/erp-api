import { MigrationInterface, QueryRunner } from 'typeorm';

const BASE_COLUMNS = `
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_reason text,
  deleted_at timestamptz,
  deleted_by uuid
`;

export class CreateAuthSchema1752600000000 implements MigrationInterface {
  name = 'CreateAuthSchema1752600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE credentials (
        ${BASE_COLUMNS},
        user_id uuid NOT NULL,
        username varchar(100) NOT NULL,
        password_hash varchar(200) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        CONSTRAINT uq_credentials_username UNIQUE (username)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_credentials_user_id ON credentials (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        ${BASE_COLUMNS},
        user_id uuid NOT NULL,
        token_hash varchar(128) NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE login_histories (
        ${BASE_COLUMNS},
        user_id uuid,
        username varchar(100) NOT NULL,
        ip_address varchar(64),
        user_agent varchar(300),
        is_success boolean NOT NULL,
        logged_in_at timestamptz NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_login_histories_user_id ON login_histories (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE blocked_users (
        ${BASE_COLUMNS},
        user_id uuid NOT NULL,
        reason varchar(200) NOT NULL,
        blocked_until timestamptz,
        blocked_by uuid
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_blocked_users_user_id ON blocked_users (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE security_logs (
        ${BASE_COLUMNS},
        event_type varchar(100) NOT NULL,
        user_id uuid,
        ip_address varchar(64),
        detail text
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_security_logs_user_id ON security_logs (user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS security_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS blocked_users`);
    await queryRunner.query(`DROP TABLE IF EXISTS login_histories`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS credentials`);
  }
}
