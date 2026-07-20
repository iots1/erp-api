import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grants the 5 `access_key:*` api-plane permissions (synced into the
 * `permissions` catalog by `permissions:sync` after the Access Keys feature's
 * `@RequirePermission()` decorators landed) to the two mock policies' existing
 * allow/api statements — mirrors `SeedIamUiPermissions1784193362117`'s grant
 * step, but for the api plane. `permissions:sync` only ever touches the
 * `permissions` catalog itself, never `statement_actions` (see its docblock),
 * so newly-synced permissions need an explicit grant like this one to
 * actually be usable by the mock superadmin/staff users.
 */
const GRANTED_PERMISSIONS = [
  'access_key:create',
  'access_key:read',
  'access_key:update',
  'access_key:revoke',
  'access_key:delete',
];

const GRANTED_POLICY_CODES = [
  'POL_SUPERADMIN_FULL_ACCESS',
  'POL_STAFF_GENERAL_ACCESS',
];

export class GrantAccessKeyPermissionsToMockPolicies1784526980034
  implements MigrationInterface
{
  name = 'GrantAccessKeyPermissionsToMockPolicies1784526980034';

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
