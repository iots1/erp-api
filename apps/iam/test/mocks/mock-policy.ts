import { Policy } from '@apps/iam/src/modules/policies/entities/policy.entity';

export const MOCK_POLICY_ID = 'c1c2c3c4-0000-4000-8000-000000000003';

export function createMockPolicy(overrides?: Partial<Policy>): Policy {
  return {
    id: MOCK_POLICY_ID,
    code: 'POL_WAREHOUSE_GOODS_RECEIPT',
    name_th: 'คลังสินค้า · รับสินค้า',
    name_en: 'Warehouse · Goods Receipt',
    is_active: true,
    statements: [],
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
