import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `SeedIamBootstrapData` (1752600001000) only seeded 3 UI-plane permissions
 * (`page:view_dashboard`, `page:view_users`, `component:btn_add_user`) — enough
 * for the original bootstrap admin, but the real `iam-view` admin UI (sidebar
 * nav + dashboard widgets) gates on a wider set. UI-plane permissions are
 * manually curated (never touched by `permissions:sync`, see CLAUDE.md), so
 * they're added here.
 *
 * This migration necessarily runs *after* `SeedIamMockupData` (1752800000000) —
 * migration timestamps must be real `Date.now()` values, not invented ones — so
 * the wildcard `plane = 'ui'` grants that migration already made to
 * `POL_SUPERADMIN_FULL_ACCESS` / `POL_STAFF_GENERAL_ACCESS` predate these new
 * rows. This migration explicitly grants the new permissions to both policies'
 * existing allow/ui statements to keep the two mockup users' access complete.
 */
const NEW_UI_PERMISSIONS: Array<[string, string, string, string, string]> = [
  [
    'page:view_roles',
    'page_roles',
    'view_roles',
    'เข้าหน้าบทบาทการใช้งาน',
    'View roles page',
  ],
  [
    'page:view_policies',
    'page_policies',
    'view_policies',
    'เข้าหน้านโยบายความปลอดภัย',
    'View policies page',
  ],
  [
    'page:view_audit',
    'page_audit',
    'view_audit',
    'เข้าหน้าบันทึกการใช้งาน',
    'View audit log page',
  ],
  [
    'page:view_settings',
    'page_settings',
    'view_settings',
    'เข้าหน้าตั้งค่าระบบ',
    'View settings page',
  ],
  [
    'component:widget_total_users',
    'component',
    'widget_total_users',
    'กล่องสถิติ: บุคลากรทั้งหมด',
    'Total users widget',
  ],
  [
    'component:widget_total_roles',
    'component',
    'widget_total_roles',
    'กล่องสถิติ: บทบาทในระบบ',
    'Total roles widget',
  ],
  [
    'component:widget_active_policies',
    'component',
    'widget_active_policies',
    'กล่องสถิติ: นโยบายที่เปิดใช้งาน',
    'Active policies widget',
  ],
  [
    'component:widget_login_graph',
    'component',
    'widget_login_graph',
    'กราฟการเข้าใช้งาน',
    'Login analytics graph widget',
  ],
  [
    'component:btn_export_users',
    'component',
    'btn_export_users',
    'ปุ่ม Export รายชื่อผู้ใช้',
    'Export users button',
  ],
];

const GRANTED_POLICY_CODES = [
  'POL_SUPERADMIN_FULL_ACCESS',
  'POL_STAFF_GENERAL_ACCESS',
];

export class SeedIamUiPermissions1784193362117 implements MigrationInterface {
  name = 'SeedIamUiPermissions1784193362117';

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

    // Grant every new permission to each policy's existing allow/ui statement
    // (there is exactly one per policy — created by SeedIamMockupData).
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
