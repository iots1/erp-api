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

/**
 * - `permissions.permission` (resource:action) can legitimately repeat across BCs
 *   for unrelated endpoints, so the real unique key becomes (service, permission).
 * - `statement_actions.permission_id` drops its FK to `permissions` — the sync
 *   script soft-deletes stale permission rows instead of hard-deleting them, but
 *   keeping a hard FK here would still block any future hard-delete/rekey of the
 *   catalog. The index is kept for query performance; referential integrity is
 *   enforced at the application layer (PermissionResolverService only reads
 *   non-deleted rows).
 */
export class AddPermissionServiceAndSyncLog1752700000000 implements MigrationInterface {
  name = 'AddPermissionServiceAndSyncLog1752700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE permissions ADD COLUMN service varchar(100)`,
    );
    await queryRunner.query(
      `UPDATE permissions SET service = 'auth' WHERE permission = 'user_account:set_password'`,
    );
    await queryRunner.query(
      `UPDATE permissions SET service = 'iam' WHERE service IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE permissions ALTER COLUMN service SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE permissions DROP CONSTRAINT uq_permissions_permission`,
    );
    await queryRunner.query(
      `ALTER TABLE permissions ADD CONSTRAINT uq_permissions_service_permission UNIQUE (service, permission)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_permissions_service ON permissions (service)`,
    );

    await queryRunner.query(
      `ALTER TABLE statement_actions DROP CONSTRAINT fk_statement_actions_permission_id`,
    );

    await queryRunner.query(`
      CREATE TABLE permission_sync_logs (
        ${BASE_COLUMNS},
        added jsonb NOT NULL DEFAULT '[]',
        removed jsonb NOT NULL DEFAULT '[]',
        added_count int NOT NULL DEFAULT 0,
        removed_count int NOT NULL DEFAULT 0,
        unchanged_count int NOT NULL DEFAULT 0,
        triggered_by varchar(100)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS permission_sync_logs`);
    await queryRunner.query(
      `ALTER TABLE statement_actions ADD CONSTRAINT fk_statement_actions_permission_id FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE RESTRICT`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_permissions_service`);
    await queryRunner.query(
      `ALTER TABLE permissions DROP CONSTRAINT uq_permissions_service_permission`,
    );
    await queryRunner.query(
      `ALTER TABLE permissions ADD CONSTRAINT uq_permissions_permission UNIQUE (permission)`,
    );
    await queryRunner.query(`ALTER TABLE permissions DROP COLUMN service`);
  }
}
