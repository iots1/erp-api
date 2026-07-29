import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grants the 4 `report:print_template_*` api-plane permissions (synced into
 * the `permissions` catalog by `permissions:sync`, `service = 'report-bc'`,
 * after `PrintTemplatesController`'s `@RequirePermission()` decorators
 * landed) to the two mock policies' existing allow/api statements — mirrors
 * `GrantAccessKeyPermissionsToMockPolicies1784526980034`, but for a
 * non-iam service. `permissions:sync` only ever touches the `permissions`
 * catalog itself, never `statement_actions`, so newly-synced permissions
 * need an explicit grant like this one to be usable by the mock
 * superadmin/staff users.
 */
const GRANTED_PERMISSIONS = [
  'report:print_template_create',
  'report:print_template_read',
  'report:print_template_update',
  'report:print_template_delete',
];

const GRANTED_POLICY_CODES = [
  'POL_SUPERADMIN_FULL_ACCESS',
  'POL_STAFF_GENERAL_ACCESS',
];

export class GrantPrintTemplatePermissionsToMockPolicies1785291693376 implements MigrationInterface {
  name = 'GrantPrintTemplatePermissionsToMockPolicies1785291693376';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO statement_actions (statement_id, permission_id)
       SELECT ps.id, perm.id
       FROM policy_statements ps
       JOIN policies pol ON pol.id = ps.policy_id
       JOIN permissions perm ON perm.service = 'report-bc' AND perm.permission = ANY($2)
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
         SELECT id FROM permissions WHERE service = 'report-bc' AND permission = ANY($1)
       )`,
      [GRANTED_PERMISSIONS],
    );
  }
}
