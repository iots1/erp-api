import { NotFoundException } from '@nestjs/common';

import { Repository } from 'typeorm';

import { UserRoleAuditLog } from '@apps/iam/src/modules/users/entities/user-role-audit-log.entity';
import { User } from '@apps/iam/src/modules/users/entities/user.entity';
import { UsersService } from '@apps/iam/src/modules/users/services/users.service';
import { SessionSyncService } from '@apps/iam/src/modules/access/services/session-sync.service';
import { ConfigService } from '@lib/config';
import { LogsService } from '@lib/common/modules/log/logs.service';

import { createMockUser } from '../../mocks/mock-user';

type MockRepository<T extends { id: string }> = {
  findOne: jest.Mock<Promise<T | null>, [unknown]>;
  save: jest.Mock<Promise<T>, [unknown]>;
  create: jest.Mock<T, [unknown]>;
  metadata: { tableName: string };
};

function createMockRepository<T extends { id: string }>(): MockRepository<T> {
  return {
    findOne: jest.fn<Promise<T | null>, [unknown]>(),
    save: jest.fn<Promise<T>, [unknown]>(),
    create: jest.fn<T, [unknown]>(),
    metadata: { tableName: 'users' },
  };
}

type MockAuditLogRepository = {
  findOne: jest.Mock<Promise<UserRoleAuditLog | null>, [unknown]>;
  save: jest.Mock<Promise<UserRoleAuditLog[]>, [unknown]>;
  create: jest.Mock<UserRoleAuditLog, [Partial<UserRoleAuditLog>]>;
};

function createMockAuditLogRepository(): MockAuditLogRepository {
  return {
    findOne: jest.fn<Promise<UserRoleAuditLog | null>, [unknown]>(),
    save: jest.fn<Promise<UserRoleAuditLog[]>, [unknown]>(),
    create: jest
      .fn<UserRoleAuditLog, [Partial<UserRoleAuditLog>]>()
      .mockImplementation(
        (input: Partial<UserRoleAuditLog>) => input as UserRoleAuditLog,
      ),
  };
}

type MockLogsService = {
  setContext: jest.Mock<void, [string, string?]>;
  error: jest.Mock<void, [unknown, unknown?, unknown?]>;
  warn: jest.Mock<void, [unknown]>;
  log: jest.Mock<void, [unknown]>;
};

function createMockLogsService(): MockLogsService {
  return {
    setContext: jest.fn<void, [string, string?]>(),
    error: jest.fn<void, [unknown, unknown?, unknown?]>(),
    warn: jest.fn<void, [unknown]>(),
    log: jest.fn<void, [unknown]>(),
  };
}

type MockConfigService = {
  get: jest.Mock<string, [string]>;
};

function createMockConfigService(): MockConfigService {
  return {
    get: jest.fn<string, [string]>().mockReturnValue('iam'),
  };
}

type MockSessionSyncService = {
  syncUser: jest.Mock<Promise<void>, [string]>;
  syncUsersByRole: jest.Mock<Promise<void>, [string]>;
  syncUsersByPolicy: jest.Mock<Promise<void>, [string]>;
};

function createMockSessionSyncService(): MockSessionSyncService {
  return {
    syncUser: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    syncUsersByRole: jest
      .fn<Promise<void>, [string]>()
      .mockResolvedValue(undefined),
    syncUsersByPolicy: jest
      .fn<Promise<void>, [string]>()
      .mockResolvedValue(undefined),
  };
}

const ROLE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROLE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ROLE_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CURRENT_USER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('UsersService (Unit)', () => {
  let service: UsersService;
  const mockUserRepository = createMockRepository<User>();
  const mockAuditLogRepository = createMockAuditLogRepository();
  const mockSessionSync = createMockSessionSyncService();
  const mockLogger = createMockLogsService();
  const mockConfigService = createMockConfigService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('iam');
    mockAuditLogRepository.create.mockImplementation(
      (input: Partial<UserRoleAuditLog>) => input as UserRoleAuditLog,
    );
    mockSessionSync.syncUser.mockResolvedValue(undefined);

    service = new UsersService(
      mockLogger as unknown as LogsService,
      mockConfigService as unknown as ConfigService,
      mockUserRepository as unknown as Repository<User>,
      mockAuditLogRepository as unknown as Repository<UserRoleAuditLog>,
      mockSessionSync as unknown as SessionSyncService,
    );
  });

  describe('assignRoles', () => {
    it('throws NotFoundException when user does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.assignRoles('missing-user', [ROLE_A]),
      ).rejects.toThrow(NotFoundException);

      expect(mockAuditLogRepository.save).not.toHaveBeenCalled();
      expect(mockSessionSync.syncUser).not.toHaveBeenCalled();
    });

    it('records only attached entries when roles are newly added', async () => {
      const user = createMockUser({ roles: [] });
      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      await service.assignRoles(user.id, [ROLE_A, ROLE_B], CURRENT_USER_ID);

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: [{ id: ROLE_A }, { id: ROLE_B }],
        }),
      );
      expect(mockAuditLogRepository.save).toHaveBeenCalledTimes(1);
      const savedEntries = mockAuditLogRepository.save.mock
        .calls[0][0] as UserRoleAuditLog[];
      expect(savedEntries).toHaveLength(2);
      expect(savedEntries.every((entry) => entry.action === 'attached')).toBe(
        true,
      );
      expect(mockSessionSync.syncUser).toHaveBeenCalledWith(user.id);
    });

    it('records only detached entries when roles are removed', async () => {
      const user = createMockUser({
        roles: [{ id: ROLE_A }, { id: ROLE_B }] as User['roles'],
      });
      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      await service.assignRoles(user.id, [ROLE_A], CURRENT_USER_ID);

      expect(mockAuditLogRepository.save).toHaveBeenCalledTimes(1);
      const savedEntries = mockAuditLogRepository.save.mock
        .calls[0][0] as UserRoleAuditLog[];
      expect(savedEntries).toHaveLength(1);
      expect(savedEntries[0].action).toBe('detached');
      expect(savedEntries[0].role_id).toBe(ROLE_B);
    });

    it('records both attached and detached entries on a mixed diff', async () => {
      const user = createMockUser({
        roles: [{ id: ROLE_A }, { id: ROLE_B }] as User['roles'],
      });
      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      await service.assignRoles(user.id, [ROLE_B, ROLE_C], CURRENT_USER_ID);

      expect(mockAuditLogRepository.save).toHaveBeenCalledTimes(1);
      const savedEntries = mockAuditLogRepository.save.mock
        .calls[0][0] as UserRoleAuditLog[];
      const attached = savedEntries.filter((e) => e.action === 'attached');
      const detached = savedEntries.filter((e) => e.action === 'detached');
      expect(attached).toHaveLength(1);
      expect(attached[0].role_id).toBe(ROLE_C);
      expect(detached).toHaveLength(1);
      expect(detached[0].role_id).toBe(ROLE_A);
    });

    it('skips the audit save when the role set is unchanged', async () => {
      const user = createMockUser({
        roles: [{ id: ROLE_A }, { id: ROLE_B }] as User['roles'],
      });
      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.save.mockResolvedValue(user);

      await service.assignRoles(user.id, [ROLE_A, ROLE_B], CURRENT_USER_ID);

      expect(mockAuditLogRepository.save).not.toHaveBeenCalled();
      expect(mockSessionSync.syncUser).toHaveBeenCalledWith(user.id);
    });
  });

  describe('findRoleIds', () => {
    it('returns role ids for a user with roles', async () => {
      const user = createMockUser({
        roles: [{ id: ROLE_A }, { id: ROLE_B }] as User['roles'],
      });
      mockUserRepository.findOne.mockResolvedValue(user);

      const result = await service.findRoleIds(user.id);

      expect(result).toEqual([ROLE_A, ROLE_B]);
    });

    it('returns an empty array for a user with no roles', async () => {
      const user = createMockUser({ roles: [] });
      mockUserRepository.findOne.mockResolvedValue(user);

      const result = await service.findRoleIds(user.id);

      expect(result).toEqual([]);
    });

    it('returns an empty array (nullish-coalescing) when the user is not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findRoleIds('missing-user');

      expect(result).toEqual([]);
    });
  });
});
