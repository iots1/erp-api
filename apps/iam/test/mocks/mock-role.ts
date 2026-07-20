import { Role } from '@apps/iam/src/modules/roles/entities/role.entity';

export const MOCK_ROLE_ID = '33333333-3333-3333-3333-333333333333';

export function createMockRole(overrides?: Partial<Role>): Role {
  return {
    id: MOCK_ROLE_ID,
    code: 'ROLE_WAREHOUSE_MANAGER',
    name_th: 'ผู้จัดการคลังสินค้า',
    name_en: 'Warehouse Manager',
    description: null,
    policies: [],
    users: [],
    created_at: new Date(),
    created_by: null,
    updated_at: new Date(),
    updated_by: null,
    is_deleted: false,
    deleted_reason: null,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  };
}
