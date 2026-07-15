import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bootstrap admin user id — kept identical to the credential row seeded in
 * erp_auth (libs/database/src/migrations/erp_auth) so the first login works
 * out of the box. Users are cross-BC referenced by this UUID only.
 */
export const BOOTSTRAP_ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';

const API_PERMISSIONS: Array<[string, string, string, string, string]> = [
  [
    'user_account:read',
    'user_account',
    'read',
    'ดูบัญชีผู้ใช้',
    'View user accounts',
  ],
  [
    'user_account:create',
    'user_account',
    'create',
    'สร้างบัญชีผู้ใช้',
    'Create user accounts',
  ],
  [
    'user_account:assign_role',
    'user_account',
    'assign_role',
    'กำหนดบทบาทผู้ใช้',
    'Assign roles to users',
  ],
  [
    'user_account:set_password',
    'user_account',
    'set_password',
    'ตั้งรหัสผ่านผู้ใช้',
    'Set user password',
  ],
  ['role:read', 'role', 'read', 'ดูบทบาท', 'View roles'],
  ['role:create', 'role', 'create', 'สร้างบทบาท', 'Create roles'],
  ['role:update', 'role', 'update', 'แก้ไขบทบาท', 'Update roles'],
  ['policy:read', 'policy', 'read', 'ดูนโยบาย', 'View policies'],
  ['policy:create', 'policy', 'create', 'สร้างนโยบาย', 'Create policies'],
  [
    'permission:read',
    'permission',
    'read',
    'ดูแคตตาล็อกสิทธิ์',
    'View permission catalog',
  ],
];

const UI_PERMISSIONS: Array<[string, string, string, string, string]> = [
  [
    'page:view_dashboard',
    'page_dashboard',
    'view_dashboard',
    'เข้าหน้าแดชบอร์ด',
    'View dashboard page',
  ],
  [
    'page:view_users',
    'page_users',
    'view_users',
    'เข้าหน้าผู้ใช้งาน',
    'View users page',
  ],
  [
    'component:btn_add_user',
    'component',
    'btn_add_user',
    'ปุ่มเพิ่มบุคลากร',
    'Add user button',
  ],
];

export class SeedIamBootstrapData1752600001000 implements MigrationInterface {
  name = 'SeedIamBootstrapData1752600001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [permission, resource, action, th, en] of [
      ...API_PERMISSIONS,
      ...UI_PERMISSIONS,
    ]) {
      const plane = UI_PERMISSIONS.some((p) => p[0] === permission)
        ? 'ui'
        : 'api';
      await queryRunner.query(
        `INSERT INTO permissions (permission, resource, action, plane, permission_name_th, permission_name_en)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [permission, resource, action, plane, th, en],
      );
    }

    await queryRunner.query(
      `INSERT INTO roles (code, name_th, name_en, description)
       VALUES ('ROLE_SECURITY_ADMIN', 'ผู้ดูแลความปลอดภัย', 'Security Administrator', 'บทบาทเริ่มต้นสำหรับผู้ดูแลระบบ (bootstrap)')`,
    );

    await queryRunner.query(
      `INSERT INTO policies (code, name_th, name_en, is_active)
       VALUES ('POL_SECURITY_ADMIN_FULL_ACCESS', 'สิทธิ์เต็มผู้ดูแลความปลอดภัย', 'Security Admin Full Access', true)`,
    );

    const [apiStatement] = (await queryRunner.query(
      `INSERT INTO policy_statements (policy_id, effect, plane)
       SELECT id, 'allow', 'api' FROM policies WHERE code = 'POL_SECURITY_ADMIN_FULL_ACCESS'
       RETURNING id`,
    )) as Array<{ id: string }>;

    await queryRunner.query(
      `INSERT INTO statement_targets (statement_id, service, resource) VALUES ($1, '*', '*')`,
      [apiStatement.id],
    );
    await queryRunner.query(
      `INSERT INTO statement_actions (statement_id, permission_id)
       SELECT $1, id FROM permissions WHERE plane = 'api'`,
      [apiStatement.id],
    );

    const [uiStatement] = (await queryRunner.query(
      `INSERT INTO policy_statements (policy_id, effect, plane)
       SELECT id, 'allow', 'ui' FROM policies WHERE code = 'POL_SECURITY_ADMIN_FULL_ACCESS'
       RETURNING id`,
    )) as Array<{ id: string }>;

    await queryRunner.query(
      `INSERT INTO statement_targets (statement_id, service, resource) VALUES ($1, 'frontend-ui', '*')`,
      [uiStatement.id],
    );
    await queryRunner.query(
      `INSERT INTO statement_actions (statement_id, permission_id)
       SELECT $1, id FROM permissions WHERE plane = 'ui'`,
      [uiStatement.id],
    );

    await queryRunner.query(
      `INSERT INTO role_policies (role_id, policy_id)
       SELECT r.id, p.id FROM roles r, policies p
       WHERE r.code = 'ROLE_SECURITY_ADMIN' AND p.code = 'POL_SECURITY_ADMIN_FULL_ACCESS'`,
    );

    await queryRunner.query(
      `INSERT INTO users (id, username, employee_id, full_name, email, department, status)
       VALUES ($1, 'admin', 'EMP-0001', 'System Administrator', 'admin@erp.local', NULL, 'active')`,
      [BOOTSTRAP_ADMIN_USER_ID],
    );

    await queryRunner.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE code = 'ROLE_SECURITY_ADMIN'`,
      [BOOTSTRAP_ADMIN_USER_ID],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM user_roles WHERE user_id = $1`, [
      BOOTSTRAP_ADMIN_USER_ID,
    ]);
    await queryRunner.query(`DELETE FROM users WHERE id = $1`, [
      BOOTSTRAP_ADMIN_USER_ID,
    ]);
    await queryRunner.query(
      `DELETE FROM role_policies WHERE policy_id IN (SELECT id FROM policies WHERE code = 'POL_SECURITY_ADMIN_FULL_ACCESS')`,
    );
    await queryRunner.query(
      `DELETE FROM statement_actions WHERE statement_id IN (SELECT id FROM policy_statements WHERE policy_id IN (SELECT id FROM policies WHERE code = 'POL_SECURITY_ADMIN_FULL_ACCESS'))`,
    );
    await queryRunner.query(
      `DELETE FROM statement_targets WHERE statement_id IN (SELECT id FROM policy_statements WHERE policy_id IN (SELECT id FROM policies WHERE code = 'POL_SECURITY_ADMIN_FULL_ACCESS'))`,
    );
    await queryRunner.query(
      `DELETE FROM policy_statements WHERE policy_id IN (SELECT id FROM policies WHERE code = 'POL_SECURITY_ADMIN_FULL_ACCESS')`,
    );
    await queryRunner.query(
      `DELETE FROM policies WHERE code = 'POL_SECURITY_ADMIN_FULL_ACCESS'`,
    );
    await queryRunner.query(
      `DELETE FROM roles WHERE code = 'ROLE_SECURITY_ADMIN'`,
    );
    await queryRunner.query(
      `DELETE FROM permissions WHERE permission IN (${[
        ...API_PERMISSIONS,
        ...UI_PERMISSIONS,
      ]
        .map((p) => `'${p[0]}'`)
        .join(', ')})`,
    );
  }
}
