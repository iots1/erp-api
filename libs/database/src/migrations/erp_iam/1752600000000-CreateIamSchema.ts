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

export class CreateIamSchema1752600000000 implements MigrationInterface {
  name = 'CreateIamSchema1752600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE users (
        ${BASE_COLUMNS},
        username varchar(100) NOT NULL,
        employee_id varchar(50) NOT NULL,
        full_name varchar(200) NOT NULL,
        email varchar(200) NOT NULL,
        department varchar(100),
        status varchar(20) NOT NULL DEFAULT 'pending',
        CONSTRAINT uq_users_username UNIQUE (username),
        CONSTRAINT uq_users_email UNIQUE (email),
        CONSTRAINT chk_users_status CHECK (status IN ('active', 'pending', 'suspended'))
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_users_status ON users (status)`);

    await queryRunner.query(`
      CREATE TABLE roles (
        ${BASE_COLUMNS},
        code varchar(100) NOT NULL,
        name_th varchar(200) NOT NULL,
        name_en varchar(200) NOT NULL,
        description text,
        CONSTRAINT uq_roles_code UNIQUE (code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE user_roles (
        ${BASE_COLUMNS},
        user_id uuid NOT NULL,
        role_id uuid NOT NULL,
        CONSTRAINT fk_user_roles_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_user_roles_role_id FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
        CONSTRAINT uq_user_roles_user_id_role_id UNIQUE (user_id, role_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_user_roles_user_id ON user_roles (user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE policies (
        ${BASE_COLUMNS},
        code varchar(100) NOT NULL,
        name_th varchar(200) NOT NULL,
        name_en varchar(200) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        CONSTRAINT uq_policies_code UNIQUE (code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE role_policies (
        ${BASE_COLUMNS},
        role_id uuid NOT NULL,
        policy_id uuid NOT NULL,
        CONSTRAINT fk_role_policies_role_id FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
        CONSTRAINT fk_role_policies_policy_id FOREIGN KEY (policy_id) REFERENCES policies (id) ON DELETE CASCADE,
        CONSTRAINT uq_role_policies_role_id_policy_id UNIQUE (role_id, policy_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_role_policies_role_id ON role_policies (role_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE permissions (
        ${BASE_COLUMNS},
        permission varchar(150) NOT NULL,
        resource varchar(100) NOT NULL,
        action varchar(100) NOT NULL,
        plane varchar(10) NOT NULL,
        permission_name_th varchar(200) NOT NULL,
        permission_name_en varchar(200) NOT NULL,
        CONSTRAINT uq_permissions_permission UNIQUE (permission),
        CONSTRAINT chk_permissions_plane CHECK (plane IN ('ui', 'api'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE policy_statements (
        ${BASE_COLUMNS},
        policy_id uuid NOT NULL,
        effect varchar(10) NOT NULL,
        plane varchar(10) NOT NULL,
        CONSTRAINT fk_policy_statements_policy_id FOREIGN KEY (policy_id) REFERENCES policies (id) ON DELETE CASCADE,
        CONSTRAINT chk_policy_statements_effect CHECK (effect IN ('allow', 'deny')),
        CONSTRAINT chk_policy_statements_plane CHECK (plane IN ('ui', 'api'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_policy_statements_policy_id ON policy_statements (policy_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE statement_targets (
        ${BASE_COLUMNS},
        statement_id uuid NOT NULL,
        service varchar(100) NOT NULL,
        resource varchar(100) NOT NULL,
        CONSTRAINT fk_statement_targets_statement_id FOREIGN KEY (statement_id) REFERENCES policy_statements (id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_statement_targets_statement_id ON statement_targets (statement_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE statement_actions (
        ${BASE_COLUMNS},
        statement_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        CONSTRAINT fk_statement_actions_statement_id FOREIGN KEY (statement_id) REFERENCES policy_statements (id) ON DELETE CASCADE,
        CONSTRAINT fk_statement_actions_permission_id FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_statement_actions_statement_id ON statement_actions (statement_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_statement_actions_permission_id ON statement_actions (permission_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE statement_conditions (
        ${BASE_COLUMNS},
        statement_id uuid NOT NULL,
        operator varchar(50) NOT NULL,
        condition_key varchar(150) NOT NULL,
        condition_value varchar(300) NOT NULL,
        CONSTRAINT fk_statement_conditions_statement_id FOREIGN KEY (statement_id) REFERENCES policy_statements (id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_statement_conditions_statement_id ON statement_conditions (statement_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS statement_conditions`);
    await queryRunner.query(`DROP TABLE IF EXISTS statement_actions`);
    await queryRunner.query(`DROP TABLE IF EXISTS statement_targets`);
    await queryRunner.query(`DROP TABLE IF EXISTS policy_statements`);
    await queryRunner.query(`DROP TABLE IF EXISTS permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS role_policies`);
    await queryRunner.query(`DROP TABLE IF EXISTS policies`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
