import { Permission } from '@apps/iam/src/modules/permissions/entities/permission.entity';
import { PolicyStatement } from '@apps/iam/src/modules/policies/entities/policy-statement.entity';
import { Policy } from '@apps/iam/src/modules/policies/entities/policy.entity';
import { StatementAction } from '@apps/iam/src/modules/policies/entities/statement-action.entity';
import { StatementCondition } from '@apps/iam/src/modules/policies/entities/statement-condition.entity';
import { StatementTarget } from '@apps/iam/src/modules/policies/entities/statement-target.entity';
import { Role } from '@apps/iam/src/modules/roles/entities/role.entity';
import { User } from '@apps/iam/src/modules/users/entities/user.entity';

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-1',
    username: 'jdoe',
    employee_id: 'EMP001',
    full_name: 'John Doe',
    email: 'jdoe@example.com',
    department: 'IT',
    status: 'active',
    roles: [],
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_by: null,
    updated_by: null,
    deleted_by: null,
    deleted_at: null,
    is_deleted: false,
    ...overrides,
  } as User;
}

export function createMockRole(overrides?: Partial<Role>): Role {
  return {
    id: 'role-1',
    code: 'ROLE_WAREHOUSE_MANAGER',
    name_th: 'ผู้จัดการคลังสินค้า',
    name_en: 'Warehouse Manager',
    description: null,
    policies: [],
    users: [],
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_by: null,
    updated_by: null,
    deleted_by: null,
    deleted_at: null,
    is_deleted: false,
    ...overrides,
  } as Role;
}

export function createMockPolicy(overrides?: Partial<Policy>): Policy {
  return {
    id: 'policy-1',
    code: 'POL_WAREHOUSE_GOODS_RECEIPT',
    name_th: 'นโยบายรับสินค้า',
    name_en: 'Goods Receipt Policy',
    is_active: true,
    statements: [],
    roles: [],
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_by: null,
    updated_by: null,
    deleted_by: null,
    deleted_at: null,
    is_deleted: false,
    ...overrides,
  } as Policy;
}

export function createMockPolicyStatement(
  overrides?: Partial<PolicyStatement>,
): PolicyStatement {
  return {
    id: 'statement-1',
    policy_id: 'policy-1',
    effect: 'allow',
    plane: 'api',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_by: null,
    updated_by: null,
    deleted_by: null,
    deleted_at: null,
    is_deleted: false,
    ...overrides,
  } as PolicyStatement;
}

export function createMockStatementTarget(
  overrides?: Partial<StatementTarget>,
): StatementTarget {
  return {
    id: 'target-1',
    statement_id: 'statement-1',
    service: 'inventory-bc',
    resource: '*',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_by: null,
    updated_by: null,
    deleted_by: null,
    deleted_at: null,
    is_deleted: false,
    ...overrides,
  } as StatementTarget;
}

export function createMockStatementAction(
  overrides?: Partial<StatementAction>,
): StatementAction {
  return {
    id: 'action-1',
    statement_id: 'statement-1',
    permission_id: 'permission-1',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_by: null,
    updated_by: null,
    deleted_by: null,
    deleted_at: null,
    is_deleted: false,
    ...overrides,
  } as StatementAction;
}

export function createMockStatementCondition(
  overrides?: Partial<StatementCondition>,
): StatementCondition {
  return {
    id: 'condition-1',
    statement_id: 'statement-1',
    operator: 'StringEquals',
    condition_key: 'context.department',
    condition_value: 'IT',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_by: null,
    updated_by: null,
    deleted_by: null,
    deleted_at: null,
    is_deleted: false,
    ...overrides,
  } as StatementCondition;
}

export function createMockPermission(
  overrides?: Partial<Permission>,
): Permission {
  return {
    id: 'permission-1',
    service: 'inventory-bc',
    permission: 'inventory:read',
    resource: 'inventory',
    action: 'read',
    plane: 'api',
    permission_name_th: 'ดูคลังสินค้า',
    permission_name_en: 'View inventory',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_by: null,
    updated_by: null,
    deleted_by: null,
    deleted_at: null,
    is_deleted: false,
    ...overrides,
  } as Permission;
}
