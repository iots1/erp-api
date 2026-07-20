import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `page:view_access_keys` UI-plane permission gating the new Access
 * Keys admin page (sidebar nav item + `bootAdminPage({ pagePermission: ... })`
 * redirect guard). UI-plane permissions are manually curated (never touched
 * by `permissions:sync`, see CLAUDE.md) — mirrors
 * `SeedIamUiPermissions1784193362117`.
 */
const NEW_UI_PERMISSIONS: Array<[string, string, string, string, string]> = [
  [
    'page:view_access_keys',
    'page_access_keys',
    'view_access_keys',
    'เข้าหน้า Access Keys',
    'View access keys page',
  ],
];

const GRANTED_POLICY_CODES = [
  'POL_SUPERADMIN_FULL_ACCESS',
  'POL_STAFF_GENERAL_ACCESS',
];

export class SeedAccessKeysUiPermission1784526821534
  implements MigrationInterface
{
  name = 'SeedAccessKeysUiPermission1784526821534';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const permissionIds: string[] = [];

    for (const [permission, resource, action, th, en] of NEW_UI_PERMISSIONS) {
      const [row] = (await queryRunner.query(
        `INSERT INTO permissions (service, permission, resource, action, plane, permission_name_th, permission_name_en)
         VALUES ('iam', $1, $2, $3, 'ui', $4, $5)
         RETURNING id`,
        [permission, resource, action, th, en],
      )) as Array<{ id: string }>;
      permissionIds.push(row.id);
    }

    await queryRunner.query(
      `INSERT INTO statement_actions (statement_id, permission_id)
       SELECT ps.id, perm.id
       FROM policy_statements ps
       JOIN policies pol ON pol.id = ps.policy_id
       CROSS JOIN unnest($2::uuid[]) AS perm(id)
       WHERE pol.code = ANY($1)
         AND ps.effect = 'allow'
         AND ps.plane = 'ui'`,
      [GRANTED_POLICY_CODES, permissionIds],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const permissions = NEW_UI_PERMISSIONS.map((p) => p[0]);

    await queryRunner.query(
      `DELETE FROM statement_actions
       WHERE permission_id IN (SELECT id FROM permissions WHERE permission = ANY($1) AND service = 'iam')`,
      [permissions],
    );
    await queryRunner.query(
      `DELETE FROM permissions WHERE service = 'iam' AND permission = ANY($1)`,
      [permissions],
    );
  }
}
