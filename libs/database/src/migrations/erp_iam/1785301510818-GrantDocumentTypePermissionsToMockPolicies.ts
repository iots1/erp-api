import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Grants the 6 `report:document_type_*` api-plane permissions (synced by
 * `permissions:sync`, `service = 'report-bc'`, after
 * `DocumentTypesController`'s `@RequirePermission()` decorators landed) to
 * the two mock policies' existing allow/api statements — mirrors
 * `GrantPrintTemplatePermissionsToMockPolicies1785291693376`.
 */
const GRANTED_PERMISSIONS = [
  'report:document_type_create',
  'report:document_type_read',
  'report:document_type_update',
  'report:document_type_delete',
  'report:document_type_running_number_read',
  'report:document_type_running_number_generate',
];

const GRANTED_POLICY_CODES = [
  'POL_SUPERADMIN_FULL_ACCESS',
  'POL_STAFF_GENERAL_ACCESS',
];

export class GrantDocumentTypePermissionsToMockPolicies1785301510818
  implements MigrationInterface
{
  name = 'GrantDocumentTypePermissionsToMockPolicies1785301510818';

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
