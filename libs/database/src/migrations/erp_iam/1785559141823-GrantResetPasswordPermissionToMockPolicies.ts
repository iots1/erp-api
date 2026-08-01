import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grants the `user_account:reset_password` api-plane permission (synced into
 * the `permissions` catalog by `permissions:sync` after the users list page's
 * "Reset Password" row action landed) to the two mock policies' existing
 * allow/api statements — mirrors `GrantAccessKeyPermissionsToMockPolicies`.
 * `permissions:sync` only ever touches the `permissions` catalog itself,
 * never `statement_actions` (see its docblock), so a newly-synced permission
 * needs an explicit grant like this one to actually be usable by the mock
 * superadmin/staff users.
 */
const GRANTED_PERMISSIONS = ['user_account:reset_password'];

const GRANTED_POLICY_CODES = [
  'POL_SUPERADMIN_FULL_ACCESS',
  'POL_STAFF_GENERAL_ACCESS',
];

export class GrantResetPasswordPermissionToMockPolicies1785559141823
  implements MigrationInterface
{
  name = 'GrantResetPasswordPermissionToMockPolicies1785559141823';

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
