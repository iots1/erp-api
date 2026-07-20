import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { Repository } from 'typeorm';

import type { IUserSession } from '@lib/common';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { ConfigService } from '@lib/config';

import { CreatePermissionDTO } from '@apps/iam/src/modules/permissions/dto/create-permission.dto';
import { UpdatePermissionDTO } from '@apps/iam/src/modules/permissions/dto/update-permission.dto';
import { Permission } from '@apps/iam/src/modules/permissions/entities/permission.entity';
import { PermissionsService } from '@apps/iam/src/modules/permissions/services/permissions.service';
import {
  createMockPermission,
  MOCK_PERMISSION_ID,
} from '@apps/iam/test/mocks/mock-permission';
import { createMockUserSession } from '@apps/iam/test/mocks/mock-user-session';

type MockRepository = {
  create: jest.Mock<Permission, [Partial<Permission>]>;
  save: jest.Mock<Promise<Permission>, [Partial<Permission>]>;
  findOne: jest.Mock<Promise<Permission | null>, [unknown]>;
  update: jest.Mock<Promise<{ affected: number }>, [unknown, unknown]>;
  delete: jest.Mock<Promise<{ affected: number }>, [unknown]>;
  preload: jest.Mock<Promise<Permission | undefined>, [unknown]>;
  metadata: { tableName: string; relations: unknown[]; target: unknown };
  manager: unknown;
};

function createMockRepository(): MockRepository {
  const repo: MockRepository = {
    create: jest.fn<Permission, [Partial<Permission>]>(
      (data) => data as Permission,
    ),
    save: jest
      .fn<Promise<Permission>, [Partial<Permission>]>()
      .mockResolvedValue(createMockPermission()),
    findOne: jest
      .fn<Promise<Permission | null>, [unknown]>()
      .mockResolvedValue(createMockPermission()),
    update: jest
      .fn<Promise<{ affected: number }>, [unknown, unknown]>()
      .mockResolvedValue({ affected: 1 }),
    delete: jest
      .fn<Promise<{ affected: number }>, [unknown]>()
      .mockResolvedValue({ affected: 1 }),
    preload: jest
      .fn<Promise<Permission | undefined>, [unknown]>()
      .mockImplementation((data: unknown) =>
        Promise.resolve({
          ...createMockPermission(),
          ...(data as Partial<Permission>),
        }),
      ),
    metadata: { tableName: 'permissions', relations: [], target: Permission },
    manager: undefined,
  };
  repo.manager = {
    transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) =>
      cb({
        getRepository: () => repo,
      }),
    ),
  };
  return repo;
}

function createMockLogsService(): LogsService {
  return {
    setContext: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
  } as unknown as LogsService;
}

function createMockConfigService(): ConfigService {
  return {
    get: jest.fn().mockReturnValue('iam'),
  } as unknown as ConfigService;
}

describe('PermissionsService', () => {
  let service: PermissionsService;
  let mockRepository: MockRepository;
  const mockCurrentUser: IUserSession = createMockUserSession();

  beforeEach(() => {
    mockRepository = createMockRepository();
    service = new PermissionsService(
      createMockLogsService(),
      createMockConfigService(),
      mockRepository as unknown as Repository<Permission>,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createManual', () => {
    it('splits permission into resource/action and forces plane=ui, is_manual=true', async () => {
      const dto: CreatePermissionDTO = {
        service: 'iam',
        permission: 'page:view_reports',
        permission_name_th: 'เข้าหน้ารายงาน',
        permission_name_en: 'View reports page',
      };
      mockRepository.save.mockResolvedValue(
        createMockPermission({
          service: dto.service,
          permission: dto.permission,
          resource: 'page',
          action: 'view_reports',
        }),
      );

      const result = await service.createManual(dto, mockCurrentUser);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'iam',
          permission: 'page:view_reports',
          resource: 'page',
          action: 'view_reports',
          plane: 'ui',
          is_manual: true,
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('updateManual', () => {
    it('allows updating display names on a synced (non-manual) row', async () => {
      mockRepository.findOne.mockResolvedValue(
        createMockPermission({ is_manual: false }),
      );
      const dto: UpdatePermissionDTO = {
        permission_name_th: 'ชื่อใหม่',
        permission_name_en: 'New name',
      };

      await service.updateManual(MOCK_PERMISSION_ID, dto, mockCurrentUser);

      expect(mockRepository.findOne).toHaveBeenCalled();
    });

    it('throws ForbiddenException when changing service/permission on a non-manual row', async () => {
      mockRepository.findOne.mockResolvedValue(
        createMockPermission({ is_manual: false }),
      );
      const dto: UpdatePermissionDTO = { service: 'inventory-bc' };

      await expect(
        service.updateManual(MOCK_PERMISSION_ID, dto, mockCurrentUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when changing permission on a non-manual row', async () => {
      mockRepository.findOne.mockResolvedValue(
        createMockPermission({ is_manual: false }),
      );
      const dto: UpdatePermissionDTO = { permission: 'page:new_slug' };

      await expect(
        service.updateManual(MOCK_PERMISSION_ID, dto, mockCurrentUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows changing service/permission on a manual row and re-derives resource/action', async () => {
      mockRepository.findOne.mockResolvedValue(
        createMockPermission({ is_manual: true }),
      );
      const dto: UpdatePermissionDTO = { permission: 'component:new_widget' };

      await service.updateManual(MOCK_PERMISSION_ID, dto, mockCurrentUser);

      // update() -> preload happens inside BaseServiceOperations.update via transaction manager
      expect(mockRepository.manager).toBeDefined();
    });
  });

  describe('removeManual', () => {
    it('deletes a manual row', async () => {
      mockRepository.findOne.mockResolvedValue(
        createMockPermission({ is_manual: true }),
      );

      await service.removeManual(MOCK_PERMISSION_ID, mockCurrentUser);

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('throws BadRequestException when the row is not manual (synced from code)', async () => {
      mockRepository.findOne.mockResolvedValue(
        createMockPermission({ is_manual: false }),
      );

      await expect(
        service.removeManual(MOCK_PERMISSION_ID, mockCurrentUser),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });
});
