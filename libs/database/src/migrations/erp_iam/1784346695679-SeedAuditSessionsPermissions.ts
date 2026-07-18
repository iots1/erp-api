import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the sidebar/menu permission for the new "active sessions" iam-view page
 * (`page:view_sessions` — UI plane, manually curated like every other `page:*`
 * row, see CLAUDE.md and `SeedIamUiPermissions` 1784193362117) and grants both
 * that permission and the API-plane `session:read` / `session:revoke` /
 * `login_history:read` permissions (already inserted by `permissions:sync`,
 * since `@RequirePermission()` decorators exist on `SessionsController` /
 * `LoginHistoriesController` in apps/auth) to the two mockup policies, so the
 * new audit-logs and active-sessions pages work end-to-end for both seeded
 * users without a manual policy edit.
 */
const NEW_UI_PERMISSION: [string, string, string, string, string] = [
  'page:view_sessions',
  'page_sessions',
  'view_sessions',
  'เข้าหน้าผู้ใช้งานที่ออนไลน์',
  'View active sessions page',
];

const API_PERMISSIONS_TO_GRANT = [
  'login_history:read',
  'session:read',
  'session:revoke',
];

const GRANTED_POLICY_CODES = [
  'POL_SUPERADMIN_FULL_ACCESS',
  'POL_STAFF_GENERAL_ACCESS',
];

export class SeedAuditSessionsPermissions1784346695679
  implements MigrationInterface
{
  name = 'SeedAuditSessionsPermissions1784346695679';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [permission, resource, action, th, en] = NEW_UI_PERMISSION;
    const [uiRow] = (await queryRunner.query(
      `INSERT INTO permissions (service, permission, resource, action, plane, permission_name_th, permission_name_en)
       VALUES ('iam', $1, $2, $3, 'ui', $4, $5)
       RETURNING id`,
      [permission, resource, action, th, en],
    )) as Array<{ id: string }>;

    await queryRunner.query(
      `INSERT INTO statement_actions (statement_id, permission_id)
       SELECT ps.id, $2::uuid
       FROM policy_statements ps
       JOIN policies pol ON pol.id = ps.policy_id
       WHERE pol.code = ANY($1)
         AND ps.effect = 'allow'
         AND ps.plane = 'ui'`,
      [GRANTED_POLICY_CODES, uiRow.id],
    );

    const apiPermissionIds = (await queryRunner.query(
      `SELECT id FROM permissions WHERE service = 'auth' AND permission = ANY($1)`,
      [API_PERMISSIONS_TO_GRANT],
    )) as Array<{ id: string }>;

    await queryRunner.query(
      `INSERT INTO statement_actions (statement_id, permission_id)
       SELECT ps.id, perm.id
       FROM policy_statements ps
       JOIN policies pol ON pol.id = ps.policy_id
       CROSS JOIN unnest($2::uuid[]) AS perm(id)
       WHERE pol.code = ANY($1)
         AND ps.effect = 'allow'
         AND ps.plane = 'api'`,
      [GRANTED_POLICY_CODES, apiPermissionIds.map((p) => p.id)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM statement_actions
       WHERE permission_id IN (
         SELECT id FROM permissions
         WHERE (service = 'iam' AND permission = 'page:view_sessions')
            OR (service = 'auth' AND permission = ANY($1))
       )`,
      [API_PERMISSIONS_TO_GRANT],
    );
    await queryRunner.query(
      `DELETE FROM permissions WHERE service = 'iam' AND permission = 'page:view_sessions'`,
    );
  }
}
