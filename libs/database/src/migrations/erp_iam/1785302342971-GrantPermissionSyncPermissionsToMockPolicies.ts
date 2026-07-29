import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grants the `permission_sync:create` and `permission_sync:read` api-plane
 * permissions (from `PermissionSyncsController` — `POST`/`GET
 * /permission-syncs`) to the two mock policies' existing allow/api
 * statements — mirrors `GrantAccessKeyPermissionsToMockPolicies1784526980034`.
 *
 * `permissions:sync` only ever touches the `permissions` catalog itself,
 * never `statement_actions` (see its docblock), so these rows must already
 * exist in the catalog for this INSERT...SELECT to have any effect — run
 * `npm run permissions:sync` (which scans the new
 * `@RequirePermission('permission_sync:create', ...)` /
 * `@RequirePermission('permission_sync:read', ...)` decorators) before
 * or re-run this migration's `up()` logic after, if it lands first.
 */
const GRANTED_PERMISSIONS = ['permission_sync:create', 'permission_sync:read'];

const GRANTED_POLICY_CODES = [
  'POL_SUPERADMIN_FULL_ACCESS',
  'POL_STAFF_GENERAL_ACCESS',
];

export class GrantPermissionSyncPermissionsToMockPolicies1785302342971
  implements MigrationInterface
{
  name = 'GrantPermissionSyncPermissionsToMockPolicies1785302342971';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO statement_actions (statement_id, permission_id)
       SELECT ps.id, perm.id
       FROM policy_statements ps
       JOIN policies pol ON pol.id = ps.policy_id
       JOIN permissions perm ON perm.service = 'iam' AND perm.permission = ANY($2)
       WHERE pol.code = ANY($1)
         AND ps.effect = 'allow'
         AND ps.plane = 'api'`,
      [GRANTED_POLICY_CODES, GRANTED_PERMISSIONS],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM statement_actions
       WHERE permission_id IN (
         SELECT id FROM permissions WHERE service = 'iam' AND permission = ANY($1)
       )`,
      [GRANTED_PERMISSIONS],
    );
  }
}
