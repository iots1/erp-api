import { User } from '@apps/iam/src/modules/users/entities/user.entity';

export const MOCK_USER_ID = 'b1b2c3d4-0000-4000-8000-000000000002';

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: MOCK_USER_ID,
    username: 'jane.doe',
    employee_id: 'EMP-1024',
    full_name: 'Jane Doe',
    email: 'jane.doe@erp.local',
    department: 'Warehouse',
    status: 'active',
    roles: [],
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
