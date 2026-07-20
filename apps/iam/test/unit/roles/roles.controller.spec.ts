import { type IResponsePaginatedService, type IUserSession } from '@lib/common';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';

import { AttachPolicyDTO } from '@apps/iam/src/modules/roles/dto/attach-policy.dto';
import { CreateRoleDTO } from '@apps/iam/src/modules/roles/dto/create-role.dto';
import { UpdateRoleDTO } from '@apps/iam/src/modules/roles/dto/update-role.dto';
import { RolesController } from '@apps/iam/src/modules/roles/controllers/roles.controller';
import { Role } from '@apps/iam/src/modules/roles/entities/role.entity';
import { createMockRole, MOCK_ROLE_ID } from '@apps/iam/test/mocks/mock-role';
import { createMockUserSession } from '@apps/iam/test/mocks/mock-user-session';

type MockRolesService = {
  create: jest.Mock<Promise<Role>, [CreateRoleDTO, IUserSession]>;
  findPaginated: jest.Mock<
    Promise<IResponsePaginatedService<Role[]>>,
    [QueryParamsDTO]
  >;
  findById: jest.Mock<Promise<Role>, [string]>;
  update: jest.Mock<Promise<Role>, [string, UpdateRoleDTO, IUserSession]>;
  delete: jest.Mock<Promise<void>, [string, boolean, IUserSession]>;
  findPolicyIds: jest.Mock<Promise<string[]>, [string]>;
  attachPolicies: jest.Mock<
    Promise<void>,
    [string, string[], string | undefined]
  >;
};

function createMockRolesService(): MockRolesService {
  const mockData = createMockRole();
  return {
    create: jest
      .fn<Promise<Role>, [CreateRoleDTO, IUserSession]>()
      .mockResolvedValue(mockData),
    findPaginated: jest
      .fn<Promise<IResponsePaginatedService<Role[]>>, [QueryParamsDTO]>()
      .mockResolvedValue({
        data: [mockData],
        pagination: {
          page: 1,
          page_size: 10,
          total: 1,
          total_records: 1,
          total_pages: 1,
        },
      }),
    findById: jest.fn<Promise<Role>, [string]>().mockResolvedValue(mockData),
    update: jest
      .fn<Promise<Role>, [string, UpdateRoleDTO, IUserSession]>()
      .mockResolvedValue(mockData),
    delete: jest
      .fn<Promise<void>, [string, boolean, IUserSession]>()
      .mockResolvedValue(undefined),
    findPolicyIds: jest
      .fn<Promise<string[]>, [string]>()
      .mockResolvedValue(['policy-1']),
    attachPolicies: jest
      .fn<Promise<void>, [string, string[], string | undefined]>()
      .mockResolvedValue(undefined),
  };
}

describe('RolesController', () => {
  let controller: RolesController;
  const mockService = createMockRolesService();
  const mockCurrentUser: IUserSession = createMockUserSession();

  beforeEach(() => {
    controller = new RolesController(
      mockService as unknown as ConstructorParameters<
        typeof RolesController
      >[0],
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('delegates to service.create with currentUser', async () => {
      const dto: CreateRoleDTO = {
        code: 'ROLE_X',
        name_th: 'ทดสอบ',
        name_en: 'Test',
        description: null,
      };

      await controller.create(dto, mockCurrentUser);

      expect(mockService.create).toHaveBeenCalledWith(dto, mockCurrentUser);
    });
  });

  describe('findPaginated', () => {
    it('delegates to service.findPaginated', async () => {
      const query = new QueryParamsDTO();

      const result = await controller.findPaginated(query);

      expect(mockService.findPaginated).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findById', async () => {
      await controller.findOne(MOCK_ROLE_ID);

      expect(mockService.findById).toHaveBeenCalledWith(MOCK_ROLE_ID);
    });
  });

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto: UpdateRoleDTO = { name_th: 'ใหม่' };

      await controller.update(MOCK_ROLE_ID, dto, mockCurrentUser);

      expect(mockService.update).toHaveBeenCalledWith(
        MOCK_ROLE_ID,
        dto,
        mockCurrentUser,
        undefined,
      );
    });
  });

  describe('softDelete', () => {
    it('delegates to service.delete with softDelete=true (via BaseControllerOperations)', async () => {
      await controller.softDelete(MOCK_ROLE_ID, mockCurrentUser);

      expect(mockService.delete).toHaveBeenCalledWith(
        MOCK_ROLE_ID,
        true,
        mockCurrentUser,
      );
    });
  });

  describe('findPolicies', () => {
    it('returns the role id together with its policy_ids from service.findPolicyIds', async () => {
      const result = await controller.findPolicies(MOCK_ROLE_ID);

      expect(mockService.findPolicyIds).toHaveBeenCalledWith(MOCK_ROLE_ID);
      expect(result).toEqual({ id: MOCK_ROLE_ID, policy_ids: ['policy-1'] });
    });
  });

  describe('attachPolicies', () => {
    it('delegates to service.attachPolicies with currentUser.id', async () => {
      const dto: AttachPolicyDTO = { policy_ids: ['policy-a', 'policy-b'] };

      await controller.attachPolicies(MOCK_ROLE_ID, dto, mockCurrentUser);

      expect(mockService.attachPolicies).toHaveBeenCalledWith(
        MOCK_ROLE_ID,
        dto.policy_ids,
        mockCurrentUser.id ?? undefined,
      );
    });

    it('passes undefined when currentUser.id is null', async () => {
      const dto: AttachPolicyDTO = { policy_ids: ['policy-a'] };
      const userWithoutId = createMockUserSession({ id: null });

      await controller.attachPolicies(MOCK_ROLE_ID, dto, userWithoutId);

      expect(mockService.attachPolicies).toHaveBeenCalledWith(
        MOCK_ROLE_ID,
        dto.policy_ids,
        undefined,
      );
    });
  });
});
