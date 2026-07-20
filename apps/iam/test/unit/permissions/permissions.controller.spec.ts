import { type IResponsePaginatedService, type IUserSession } from '@lib/common';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';

import { PermissionsController } from '@apps/iam/src/modules/permissions/controllers/permissions.controller';
import { CreatePermissionDTO } from '@apps/iam/src/modules/permissions/dto/create-permission.dto';
import { UpdatePermissionDTO } from '@apps/iam/src/modules/permissions/dto/update-permission.dto';
import { Permission } from '@apps/iam/src/modules/permissions/entities/permission.entity';
import {
  createMockPermission,
  MOCK_PERMISSION_ID,
} from '@apps/iam/test/mocks/mock-permission';
import { createMockUserSession } from '@apps/iam/test/mocks/mock-user-session';

type MockPermissionsService = {
  findPaginated: jest.Mock<
    Promise<IResponsePaginatedService<Permission[]>>,
    [QueryParamsDTO]
  >;
  findById: jest.Mock<Promise<Permission>, [string]>;
  createManual: jest.Mock<
    Promise<Permission>,
    [CreatePermissionDTO, IUserSession]
  >;
  updateManual: jest.Mock<
    Promise<Permission>,
    [string, UpdatePermissionDTO, IUserSession]
  >;
  removeManual: jest.Mock<Promise<void>, [string, IUserSession]>;
};

function createMockPermissionsService(): MockPermissionsService {
  const mockData = createMockPermission();
  return {
    findPaginated: jest
      .fn<Promise<IResponsePaginatedService<Permission[]>>, [QueryParamsDTO]>()
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
    findById: jest
      .fn<Promise<Permission>, [string]>()
      .mockResolvedValue(mockData),
    createManual: jest
      .fn<Promise<Permission>, [CreatePermissionDTO, IUserSession]>()
      .mockResolvedValue(mockData),
    updateManual: jest
      .fn<Promise<Permission>, [string, UpdatePermissionDTO, IUserSession]>()
      .mockResolvedValue(mockData),
    removeManual: jest
      .fn<Promise<void>, [string, IUserSession]>()
      .mockResolvedValue(undefined),
  };
}

describe('PermissionsController', () => {
  let controller: PermissionsController;
  const mockService = createMockPermissionsService();
  const mockCurrentUser: IUserSession = createMockUserSession();

  beforeEach(() => {
    controller = new PermissionsController(
      mockService as unknown as ConstructorParameters<
        typeof PermissionsController
      >[0],
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findPaginated', () => {
    it('delegates to permissionsService.findPaginated', async () => {
      const query = new QueryParamsDTO();
      const result = await controller.findPaginated(query);

      expect(mockService.findPaginated).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('delegates to permissionsService.findById', async () => {
      await controller.findOne(MOCK_PERMISSION_ID);

      expect(mockService.findById).toHaveBeenCalledWith(MOCK_PERMISSION_ID);
    });
  });

  describe('create', () => {
    it('delegates to permissionsService.createManual with currentUser', async () => {
      const dto: CreatePermissionDTO = {
        service: 'iam',
        permission: 'page:view_reports',
        permission_name_th: 'เข้าหน้ารายงาน',
        permission_name_en: 'View reports page',
      };

      await controller.create(dto, mockCurrentUser);

      expect(mockService.createManual).toHaveBeenCalledWith(
        dto,
        mockCurrentUser,
      );
    });
  });

  describe('update', () => {
    it('delegates to permissionsService.updateManual', async () => {
      const dto: UpdatePermissionDTO = { permission_name_th: 'ใหม่' };

      await controller.update(MOCK_PERMISSION_ID, dto, mockCurrentUser);

      expect(mockService.updateManual).toHaveBeenCalledWith(
        MOCK_PERMISSION_ID,
        dto,
        mockCurrentUser,
      );
    });
  });

  describe('remove', () => {
    it('delegates to permissionsService.removeManual', async () => {
      await controller.remove(MOCK_PERMISSION_ID, mockCurrentUser);

      expect(mockService.removeManual).toHaveBeenCalledWith(
        MOCK_PERMISSION_ID,
        mockCurrentUser,
      );
    });
  });
});
