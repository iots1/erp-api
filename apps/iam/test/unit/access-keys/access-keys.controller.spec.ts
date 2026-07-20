import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import type { IResponsePaginatedService } from '@lib/common';
import type { IUserSession } from '@lib/common/interfaces/auth.interface';

import { AccessKeysController } from '@apps/iam/src/modules/access-keys/controllers/access-keys.controller';
import { AccessKey } from '@apps/iam/src/modules/access-keys/entities/access-key.entity';
import { AttachAccessKeyPolicyDTO } from '@apps/iam/src/modules/access-keys/dto/attach-access-key-policy.dto';
import {
  CreateAccessKeyDTO,
  CreateAccessKeyResponseDTO,
} from '@apps/iam/src/modules/access-keys/dto/create-access-key.dto';
import { UpdateAccessKeyDTO } from '@apps/iam/src/modules/access-keys/dto/update-access-key.dto';

import {
  createMockAccessKey,
  createMockCreateAccessKeyDTO,
  createMockCreateAccessKeyResponseDTO,
  createMockUpdateAccessKeyDTO,
  MOCK_ACCESS_KEY_UUID,
} from '@apps/iam/test/mocks/mock-access-key';
import { createMockUserSession } from '@apps/iam/test/mocks/mock-user-session';

export type MockAccessKeysService = {
  issue: jest.Mock<
    Promise<CreateAccessKeyResponseDTO>,
    [CreateAccessKeyDTO, IUserSession]
  >;
  findPaginated: jest.Mock<
    Promise<IResponsePaginatedService<AccessKey[]>>,
    [QueryParamsDTO]
  >;
  findById: jest.Mock<Promise<AccessKey>, [string]>;
  update: jest.Mock<
    Promise<AccessKey>,
    [string, UpdateAccessKeyDTO, IUserSession]
  >;
  findPolicyIds: jest.Mock<Promise<string[]>, [string]>;
  attachPolicies: jest.Mock<Promise<void>, [string, string[]]>;
  revoke: jest.Mock<Promise<void>, [string, IUserSession]>;
  delete: jest.Mock<Promise<void>, [string, boolean, IUserSession]>;
};

function createMockAccessKeysService(): MockAccessKeysService {
  return {
    issue: jest.fn<
      Promise<CreateAccessKeyResponseDTO>,
      [CreateAccessKeyDTO, IUserSession]
    >(),
    findPaginated: jest.fn<
      Promise<IResponsePaginatedService<AccessKey[]>>,
      [QueryParamsDTO]
    >(),
    findById: jest.fn<Promise<AccessKey>, [string]>(),
    update: jest.fn<
      Promise<AccessKey>,
      [string, UpdateAccessKeyDTO, IUserSession]
    >(),
    findPolicyIds: jest.fn<Promise<string[]>, [string]>(),
    attachPolicies: jest.fn<Promise<void>, [string, string[]]>(),
    revoke: jest.fn<Promise<void>, [string, IUserSession]>(),
    delete: jest.fn<Promise<void>, [string, boolean, IUserSession]>(),
  };
}

describe('AccessKeysController', () => {
  let controller: AccessKeysController;
  let mockService: MockAccessKeysService;
  const currentUser = createMockUserSession();

  beforeEach(() => {
    mockService = createMockAccessKeysService();
    controller = new AccessKeysController(
      mockService as unknown as ConstructorParameters<
        typeof AccessKeysController
      >[0],
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('issue', () => {
    it('delegates to service.issue with the DTO and current user', async () => {
      const dto = createMockCreateAccessKeyDTO();
      const response = createMockCreateAccessKeyResponseDTO();
      mockService.issue.mockResolvedValue(response);

      const result = await controller.issue(dto, currentUser);

      expect(mockService.issue).toHaveBeenCalledWith(dto, currentUser);
      expect(result).toBe(response);
    });
  });

  describe('findPaginated', () => {
    it('delegates to service.findPaginated', async () => {
      const query = new QueryParamsDTO();
      const paginated: IResponsePaginatedService<AccessKey[]> = {
        data: [createMockAccessKey()],
        pagination: {
          page: 1,
          page_size: 10,
          total: 1,
          total_records: 1,
          total_pages: 1,
        },
      };
      mockService.findPaginated.mockResolvedValue(paginated);

      const result = await controller.findPaginated(query);

      expect(mockService.findPaginated).toHaveBeenCalledWith(query);
      expect(result).toBe(paginated);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findById', async () => {
      const key = createMockAccessKey();
      mockService.findById.mockResolvedValue(key);

      const result = await controller.findOne(MOCK_ACCESS_KEY_UUID);

      expect(mockService.findById).toHaveBeenCalledWith(MOCK_ACCESS_KEY_UUID);
      expect(result).toBe(key);
    });
  });

  describe('update', () => {
    it('delegates to service.update with id, DTO, and current user', async () => {
      const dto = createMockUpdateAccessKeyDTO();
      const updated = createMockAccessKey({ name: dto.name });
      mockService.update.mockResolvedValue(updated);

      const result = await controller.update(
        MOCK_ACCESS_KEY_UUID,
        dto,
        currentUser,
      );

      expect(mockService.update).toHaveBeenCalledWith(
        MOCK_ACCESS_KEY_UUID,
        dto,
        currentUser,
        undefined,
      );
      expect(result).toBe(updated);
    });
  });

  describe('findPolicies', () => {
    it('returns the id and the policy_ids resolved by the service', async () => {
      mockService.findPolicyIds.mockResolvedValue(['policy-1', 'policy-2']);

      const result = await controller.findPolicies(MOCK_ACCESS_KEY_UUID);

      expect(mockService.findPolicyIds).toHaveBeenCalledWith(
        MOCK_ACCESS_KEY_UUID,
      );
      expect(result).toEqual({
        id: MOCK_ACCESS_KEY_UUID,
        policy_ids: ['policy-1', 'policy-2'],
      });
    });

    it('returns an empty policy_ids array when the key has no attached policies', async () => {
      mockService.findPolicyIds.mockResolvedValue([]);

      const result = await controller.findPolicies(MOCK_ACCESS_KEY_UUID);

      expect(result).toEqual({ id: MOCK_ACCESS_KEY_UUID, policy_ids: [] });
    });
  });

  describe('attachPolicies', () => {
    it('delegates to service.attachPolicies with the id and policy_ids', async () => {
      const dto: AttachAccessKeyPolicyDTO = {
        policy_ids: ['policy-1', 'policy-2'],
      };

      await controller.attachPolicies(MOCK_ACCESS_KEY_UUID, dto);

      expect(mockService.attachPolicies).toHaveBeenCalledWith(
        MOCK_ACCESS_KEY_UUID,
        dto.policy_ids,
      );
    });
  });

  describe('revoke', () => {
    it('delegates to service.revoke with the id and current user', async () => {
      await controller.revoke(MOCK_ACCESS_KEY_UUID, currentUser);

      expect(mockService.revoke).toHaveBeenCalledWith(
        MOCK_ACCESS_KEY_UUID,
        currentUser,
      );
    });
  });

  describe('softDelete', () => {
    it('delegates to service.delete with soft-delete flag true', async () => {
      await controller.softDelete(MOCK_ACCESS_KEY_UUID, currentUser);

      expect(mockService.delete).toHaveBeenCalledWith(
        MOCK_ACCESS_KEY_UUID,
        true,
        currentUser,
      );
    });
  });
});
