import { AccessKey } from '@apps/iam/src/modules/access-keys/entities/access-key.entity';
import { AccessKeyStatus } from '@apps/iam/src/modules/access-keys/enums/access-key-status.enum';
import {
  CreateAccessKeyDTO,
  CreateAccessKeyResponseDTO,
} from '@apps/iam/src/modules/access-keys/dto/create-access-key.dto';
import { UpdateAccessKeyDTO } from '@apps/iam/src/modules/access-keys/dto/update-access-key.dto';

export const MOCK_ACCESS_KEY_UUID = 'b1b2c3d4-0000-4000-8000-000000000002';
export const MOCK_ACCESS_KEY_ID = 'AKIA1234567890ABCDEF';
export const MOCK_OWNER_ID = 'c1b2c3d4-0000-4000-8000-000000000003';

export function createMockAccessKey(overrides?: Partial<AccessKey>): AccessKey {
  return {
    id: MOCK_ACCESS_KEY_UUID,
    access_key_id: MOCK_ACCESS_KEY_ID,
    secret_key_encrypted: 'iv-base64:tag-base64:cipher-base64',
    owner_id: MOCK_OWNER_ID,
    owner_type: 'service_account',
    name: 'Warehouse-Integration',
    description: null,
    status: AccessKeyStatus.ACTIVE,
    last_used_at: null,
    expires_at: null,
    metadata: null,
    policies: [],
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    created_by: null,
    updated_by: null,
    deleted_by: null,
    deleted_at: null,
    is_deleted: false,
    ...overrides,
  } as AccessKey;
}

export function createMockCreateAccessKeyDTO(
  overrides?: Partial<CreateAccessKeyDTO>,
): CreateAccessKeyDTO {
  return {
    name: 'Warehouse-Integration',
    description: null,
    owner_id: MOCK_OWNER_ID,
    owner_type: 'service_account',
    expires_at: null,
    metadata: null,
    ...overrides,
  };
}

export function createMockCreateAccessKeyResponseDTO(
  overrides?: Partial<CreateAccessKeyResponseDTO>,
): CreateAccessKeyResponseDTO {
  return {
    id: MOCK_ACCESS_KEY_UUID,
    access_key_id: MOCK_ACCESS_KEY_ID,
    secret_key: 'plaintext-secret-base64',
    name: 'Warehouse-Integration',
    status: AccessKeyStatus.ACTIVE,
    expires_at: null,
    ...overrides,
  };
}

export function createMockUpdateAccessKeyDTO(
  overrides?: Partial<UpdateAccessKeyDTO>,
): UpdateAccessKeyDTO {
  return {
    name: 'Updated-Name',
    ...overrides,
  };
}
