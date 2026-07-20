import { Permission } from '@apps/iam/src/modules/permissions/entities/permission.entity';

export const MOCK_PERMISSION_ID = '22222222-2222-2222-2222-222222222222';

export function createMockPermission(
  overrides?: Partial<Permission>,
): Permission {
  return {
    id: MOCK_PERMISSION_ID,
    service: 'iam',
    permission: 'page:view_reports',
    resource: 'page',
    action: 'view_reports',
    plane: 'ui',
    permission_name_th: 'เข้าหน้ารายงาน',
    permission_name_en: 'View reports page',
    is_manual: true,
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
