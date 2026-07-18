import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `page:view_permissions` — the sidebar permission for the new iam-view
 * "Permissions" page (list + manual CRUD over the permissions catalog, see
 * PermissionsController) — and grants it plus the API-plane
 * `permission:create` / `permission:update` / `permission:delete` (already
 * inserted by `permissions:sync`, since `@RequirePermission()` now exists on
 * `PermissionsController`'s write endpoints) to the two mockup policies, so
 * the page works end-to-end for both seeded users without a manual policy
 * edit. Same pattern as 1784346695679 (sessions/audit-logs).
 */
const NEW_UI_PERMISSION: [string, string, string, string, string] = [
  'page:view_permissions',
  'page_permissions',
  'view_permissions',
  'เข้าหน้าจัดการสิทธิ์',
  'View permissions page',
];

const API_PERMISSIONS_TO_GRANT = [
  'permission:create',
  'permission:update',
  'permission:delete',
];

const GRANTED_POLICY_CODES = [
  'POL_SUPERADMIN_FULL_ACCESS',
  'POL_STAFF_GENERAL_ACCESS',
];

export class SeedPermissionsPagePermissions1784350333198
  implements MigrationInterface
{
  name = 'SeedPermissionsPagePermissions1784350333198';

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
      `SELECT id FROM permissions WHERE service = 'iam' AND permission = ANY($1)`,
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
         WHERE (service = 'iam' AND permission = 'page:view_permissions')
            OR (service = 'iam' AND permission = ANY($1))
       )`,
      [API_PERMISSIONS_TO_GRANT],
    );
    await queryRunner.query(
      `DELETE FROM permissions WHERE service = 'iam' AND permission = 'page:view_permissions'`,
    );
  }
}
