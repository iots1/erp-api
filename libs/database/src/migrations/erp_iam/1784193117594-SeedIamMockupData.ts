import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mockup identity data for development: two users — `superadmin` (everything) and
 * `staff` (everything except managing user accounts).
 *
 * ## Run order matters
 *
 * This seed snapshots the `permissions` catalog into `statement_actions`, so the
 * catalog must be populated *before* it runs:
 *
 *   1. `pnpm run migration:run:iam`   (schema + earlier migrations)
 *   2. `pnpm run permissions:sync`    (fills `permissions` from @RequirePermission())
 *   3. re-run this migration          (see the revert note below)
 *
 * Because a migration only ever runs once, a first `migration:run:iam` on a fresh
 * DB would seed against whatever catalog exists at that moment. To reseed after a
 * sync: `pnpm run migration:revert:iam` then `pnpm run migration:run:iam`.
 *
 * The snapshot is a point-in-time grant: permissions added by a *later*
 * `permissions:sync` are not automatically granted to either role — reseed to pick
 * them up.
 *
 * The credential rows (username/password) for these users live in the **erp_auth**
 * database and are seeded by `erp_auth/1784193120000-SeedAuthMockupData.ts`. The
 * two files must agree on the UUIDs below — users are cross-BC referenced by UUID
 * only, and `auth` rejects a login whose IAM user is missing or not `active`.
 *
 * These are fixed uuidv7 literals, not `uuidv7()` calls: `migration:run:iam` and
 * `migration:run:auth` are separate CLI processes, so a call at module-import time
 * would generate a *different* random value in each process and silently break the
 * link between this file and the erp_auth seed that imports these constants.
 */
export const SUPERADMIN_USER_ID = '019f761a-0742-744f-b8d5-6ec2468146b4';
export const STAFF_USER_ID = '019f761d-2dbf-717a-b4c6-900f23b2c6f0';

/**
 * Denied for staff. `user_account:create` guards POST, PUT *and* DELETE on
 * /users (there is no separate update/delete permission), so denying it covers
 * add/edit/remove in one rule. `assign_role` and `set_password` are denied too:
 * either one is a privilege-escalation path around the other three — staff could
 * grant themselves ROLE_SUPERADMIN, or reset superadmin's password and log in as
 * them. Deny wins over allow in PermissionResolverService, and matching is by
 * permission string across every service (set_password is declared by `auth`).
 */
const STAFF_DENIED_API_PERMISSIONS = [
  'user_account:create',
  'user_account:assign_role',
  'user_account:set_password',
];

/** UI mirror of the denied API rules — hides the "add user" button rather than showing one that 403s. */
const STAFF_DENIED_UI_PERMISSIONS = ['component:btn_add_user'];

/** Identity tables owned by this seed. `permissions` / `permission_sync_logs` are excluded on purpose — they are owned by `permissions:sync`. */
const SEEDED_TABLES = [
  'user_roles',
  'users',
  'role_policies',
  'roles',
  'statement_actions',
  'statement_conditions',
  'statement_targets',
  'policy_statements',
  'policies',
];

export class SeedIamMockupData1784193117594 implements MigrationInterface {
  name = 'SeedIamMockupData1784193117594';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Every table is listed explicitly (no CASCADE) so the truncate can never reach
    // `permissions` — statement_actions' FK to it was dropped in 1752700000000, and
    // the catalog must survive this seed.
    await queryRunner.query(`TRUNCATE TABLE ${SEEDED_TABLES.join(', ')}`);

    await queryRunner.query(
      `INSERT INTO users (id, username, employee_id, full_name, email, department, status)
       VALUES
         ($1, 'superadmin', 'EMP-0001', 'Super Administrator', 'superadmin@erp.local', 'IT', 'active'),
         ($2, 'staff', 'EMP-0002', 'Staff User', 'staff@erp.local', 'Operations', 'active')`,
      [SUPERADMIN_USER_ID, STAFF_USER_ID],
    );

    await this.seedSuperadmin(queryRunner);
    await this.seedStaff(queryRunner);
  }

  /** ROLE_SUPERADMIN — allow every permission in the catalog, on both planes. */
  private async seedSuperadmin(queryRunner: QueryRunner): Promise<void> {
    const policyId = await this.createPolicy(
      queryRunner,
      'POL_SUPERADMIN_FULL_ACCESS',
      'สิทธิ์เต็มผู้ดูแลระบบสูงสุด',
      'Superadmin Full Access',
    );

    const apiStatementId = await this.createStatement(
      queryRunner,
      policyId,
      'allow',
      'api',
    );
    await this.addTarget(queryRunner, apiStatementId, '*', '*');
    await this.addActionsByPlane(queryRunner, apiStatementId, 'api');

    const uiStatementId = await this.createStatement(
      queryRunner,
      policyId,
      'allow',
      'ui',
    );
    await this.addTarget(queryRunner, uiStatementId, 'frontend-ui', '*');
    await this.addActionsByPlane(queryRunner, uiStatementId, 'ui');

    await this.createRoleWithPolicy(
      queryRunner,
      'ROLE_SUPERADMIN',
      'ผู้ดูแลระบบสูงสุด',
      'Super Administrator',
      'เข้าถึงได้ทุกสิทธิ์ในระบบ (mockup)',
      policyId,
      SUPERADMIN_USER_ID,
    );
  }

  /** ROLE_STAFF — allow everything, then deny the user-account rules (deny overrides allow). */
  private async seedStaff(queryRunner: QueryRunner): Promise<void> {
    const policyId = await this.createPolicy(
      queryRunner,
      'POL_STAFF_GENERAL_ACCESS',
      'สิทธิ์ทั่วไปของพนักงาน',
      'Staff General Access',
    );

    const apiAllowId = await this.createStatement(
      queryRunner,
      policyId,
      'allow',
      'api',
    );
    await this.addTarget(queryRunner, apiAllowId, '*', '*');
    await this.addActionsByPlane(queryRunner, apiAllowId, 'api');

    const uiAllowId = await this.createStatement(
      queryRunner,
      policyId,
      'allow',
      'ui',
    );
    await this.addTarget(queryRunner, uiAllowId, 'frontend-ui', '*');
    await this.addActionsByPlane(queryRunner, uiAllowId, 'ui');

    const apiDenyId = await this.createStatement(
      queryRunner,
      policyId,
      'deny',
      'api',
    );
    await this.addTarget(queryRunner, apiDenyId, '*', 'user_account');
    await this.addActionsByName(
      queryRunner,
      apiDenyId,
      STAFF_DENIED_API_PERMISSIONS,
    );

    const uiDenyId = await this.createStatement(
      queryRunner,
      policyId,
      'deny',
      'ui',
    );
    await this.addTarget(queryRunner, uiDenyId, 'frontend-ui', 'component');
    await this.addActionsByName(
      queryRunner,
      uiDenyId,
      STAFF_DENIED_UI_PERMISSIONS,
    );

    await this.createRoleWithPolicy(
      queryRunner,
      'ROLE_STAFF',
      'พนักงาน',
      'Staff',
      'เข้าถึงได้ทุกสิทธิ์ ยกเว้นการเพิ่ม/ลบ/แก้ไขบัญชีผู้ใช้ (mockup)',
      policyId,
      STAFF_USER_ID,
    );
  }

  private async createPolicy(
    queryRunner: QueryRunner,
    code: string,
    nameTh: string,
    nameEn: string,
  ): Promise<string> {
    const [policy] = (await queryRunner.query(
      `INSERT INTO policies (code, name_th, name_en, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [code, nameTh, nameEn],
    )) as Array<{ id: string }>;
    return policy.id;
  }

  private async createStatement(
    queryRunner: QueryRunner,
    policyId: string,
    effect: 'allow' | 'deny',
    plane: 'ui' | 'api',
  ): Promise<string> {
    const [statement] = (await queryRunner.query(
      `INSERT INTO policy_statements (policy_id, effect, plane)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [policyId, effect, plane],
    )) as Array<{ id: string }>;
    return statement.id;
  }

  private async addTarget(
    queryRunner: QueryRunner,
    statementId: string,
    service: string,
    resource: string,
  ): Promise<void> {
    await queryRunner.query(
      `INSERT INTO statement_targets (statement_id, service, resource) VALUES ($1, $2, $3)`,
      [statementId, service, resource],
    );
  }

  private async addActionsByPlane(
    queryRunner: QueryRunner,
    statementId: string,
    plane: 'ui' | 'api',
  ): Promise<void> {
    await queryRunner.query(
      `INSERT INTO statement_actions (statement_id, permission_id)
       SELECT $1, id FROM permissions WHERE plane = $2 AND is_deleted = false`,
      [statementId, plane],
    );
  }

  private async addActionsByName(
    queryRunner: QueryRunner,
    statementId: string,
    permissions: string[],
  ): Promise<void> {
    await queryRunner.query(
      `INSERT INTO statement_actions (statement_id, permission_id)
       SELECT $1, id FROM permissions WHERE permission = ANY($2) AND is_deleted = false`,
      [statementId, permissions],
    );
  }

  private async createRoleWithPolicy(
    queryRunner: QueryRunner,
    code: string,
    nameTh: string,
    nameEn: string,
    description: string,
    policyId: string,
    userId: string,
  ): Promise<void> {
    const [role] = (await queryRunner.query(
      `INSERT INTO roles (code, name_th, name_en, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [code, nameTh, nameEn, description],
    )) as Array<{ id: string }>;

    await queryRunner.query(
      `INSERT INTO role_policies (role_id, policy_id) VALUES ($1, $2)`,
      [role.id, policyId],
    );
    await queryRunner.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
      [userId, role.id],
    );
  }

  /**
   * Not a true inverse: `up()` truncates, so the pre-seed rows are already gone and
   * cannot be restored. This clears the tables this seed owns, returning IAM to the
   * empty state — the `permissions` catalog is deliberately left intact.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE TABLE ${SEEDED_TABLES.join(', ')}`);
  }
}
