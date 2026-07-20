import { ConflictException } from '@nestjs/common';

import { Repository } from 'typeorm';

import { LogsService } from '@lib/common/modules/log/logs.service';
import { ConfigService } from '@lib/config';

import { SessionSyncService } from '@apps/iam/src/modules/access/services/session-sync.service';
import { RolePolicyAuditLog } from '@apps/iam/src/modules/roles/entities/role-policy-audit-log.entity';
import { Role } from '@apps/iam/src/modules/roles/entities/role.entity';
import { RolesService } from '@apps/iam/src/modules/roles/services/roles.service';
import { createMockRole, MOCK_ROLE_ID } from '@apps/iam/test/mocks/mock-role';
import { createMockUserSession } from '@apps/iam/test/mocks/mock-user-session';

type QueryBuilderMock = {
  select: jest.Mock<QueryBuilderMock, [string]>;
  from: jest.Mock<QueryBuilderMock, [string, string]>;
  where: jest.Mock<QueryBuilderMock, [string, Record<string, unknown>]>;
  getCount: jest.Mock<Promise<number>, []>;
};

function createMockQueryBuilder(count: number): QueryBuilderMock {
  const qb: Partial<QueryBuilderMock> = {};
  qb.select = jest
    .fn<QueryBuilderMock, [string]>()
    .mockReturnValue(qb as QueryBuilderMock);
  qb.from = jest
    .fn<QueryBuilderMock, [string, string]>()
    .mockReturnValue(qb as QueryBuilderMock);
  qb.where = jest
    .fn<QueryBuilderMock, [string, Record<string, unknown>]>()
    .mockReturnValue(qb as QueryBuilderMock);
  qb.getCount = jest.fn<Promise<number>, []>().mockResolvedValue(count);
  return qb as QueryBuilderMock;
}

type MockRoleRepository = {
  create: jest.Mock<Role, [Partial<Role>]>;
  save: jest.Mock<Promise<Role>, [Partial<Role>]>;
  findOne: jest.Mock<Promise<Role | null>, [unknown]>;
  update: jest.Mock<Promise<{ affected: number }>, [unknown, unknown]>;
  delete: jest.Mock<Promise<{ affected: number }>, [unknown]>;
  metadata: { tableName: string; relations: unknown[]; target: unknown };
  manager: {
    createQueryBuilder: jest.Mock<QueryBuilderMock, []>;
    transaction: jest.Mock<Promise<unknown>, [(manager: unknown) => unknown]>;
  };
};

function createMockRoleRepository(attachedUserCount = 0): MockRoleRepository {
  const repo: Partial<MockRoleRepository> = {
    create: jest.fn<Role, [Partial<Role>]>((data) => data as Role),
    save: jest
      .fn<Promise<Role>, [Partial<Role>]>()
      .mockResolvedValue(createMockRole()),
    findOne: jest
      .fn<Promise<Role | null>, [unknown]>()
      .mockResolvedValue(createMockRole()),
    update: jest
      .fn<Promise<{ affected: number }>, [unknown, unknown]>()
      .mockResolvedValue({ affected: 1 }),
    delete: jest
      .fn<Promise<{ affected: number }>, [unknown]>()
      .mockResolvedValue({ affected: 1 }),
    metadata: { tableName: 'roles', relations: [], target: Role },
  };
  repo.manager = {
    createQueryBuilder: jest
      .fn<QueryBuilderMock, []>()
      .mockReturnValue(createMockQueryBuilder(attachedUserCount)),
    transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) =>
      cb({
        getRepository: () => repo,
      }),
    ),
  };
  return repo as MockRoleRepository;
}

type MockAuditLogRepository = {
  create: jest.Mock<RolePolicyAuditLog, [Partial<RolePolicyAuditLog>]>;
  save: jest.Mock<Promise<RolePolicyAuditLog[]>, [RolePolicyAuditLog[]]>;
};

function createMockAuditLogRepository(): MockAuditLogRepository {
  return {
    create: jest.fn<RolePolicyAuditLog, [Partial<RolePolicyAuditLog>]>(
      (data) => data as RolePolicyAuditLog,
    ),
    save: jest
      .fn<Promise<RolePolicyAuditLog[]>, [RolePolicyAuditLog[]]>()
      .mockResolvedValue([]),
  };
}

type MockSessionSyncService = {
  syncUsersByRole: jest.Mock<Promise<void>, [string]>;
};

function createMockSessionSyncService(): MockSessionSyncService {
  return {
    syncUsersByRole: jest
      .fn<Promise<void>, [string]>()
      .mockResolvedValue(undefined),
  };
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

function buildService(
  roleRepository: MockRoleRepository,
  auditLogRepository: MockAuditLogRepository,
  sessionSync: MockSessionSyncService,
): RolesService {
  return new RolesService(
    createMockLogsService(),
    createMockConfigService(),
    roleRepository as unknown as Repository<Role>,
    auditLogRepository as unknown as Repository<RolePolicyAuditLog>,
    sessionSync as unknown as SessionSyncService,
  );
}

describe('RolesService', () => {
  const mockCurrentUser = createMockUserSession();

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('delete', () => {
    it('throws ConflictException when the role is still attached to at least one user', async () => {
      const roleRepository = createMockRoleRepository(1);
      const auditLogRepository = createMockAuditLogRepository();
      const sessionSync = createMockSessionSyncService();
      const service = buildService(
        roleRepository,
        auditLogRepository,
        sessionSync,
      );

      await expect(
        service.delete(MOCK_ROLE_ID, true, mockCurrentUser),
      ).rejects.toThrow(ConflictException);
      expect(roleRepository.update).not.toHaveBeenCalled();
    });

    it('soft-deletes the role when no user is attached', async () => {
      const roleRepository = createMockRoleRepository(0);
      const auditLogRepository = createMockAuditLogRepository();
      const sessionSync = createMockSessionSyncService();
      const service = buildService(
        roleRepository,
        auditLogRepository,
        sessionSync,
      );

      await service.delete(MOCK_ROLE_ID, true, mockCurrentUser);

      expect(roleRepository.update).toHaveBeenCalled();
    });
  });

  describe('attachPolicies', () => {
    it('throws NotFoundException-derived error when role does not exist', async () => {
      const roleRepository = createMockRoleRepository(0);
      roleRepository.findOne.mockResolvedValue(null);
      const auditLogRepository = createMockAuditLogRepository();
      const sessionSync = createMockSessionSyncService();
      const service = buildService(
        roleRepository,
        auditLogRepository,
        sessionSync,
      );

      await expect(
        service.attachPolicies(
          MOCK_ROLE_ID,
          ['policy-1'],
          mockCurrentUser.id ?? undefined,
        ),
      ).rejects.toThrow('not found');
    });

    it('writes "attached" audit entries for newly attached policies and syncs sessions', async () => {
      const existingRole = createMockRole({
        policies: [{ id: 'policy-existing' } as never],
      });
      const roleRepository = createMockRoleRepository(0);
      roleRepository.findOne.mockResolvedValue(existingRole);
      const auditLogRepository = createMockAuditLogRepository();
      const sessionSync = createMockSessionSyncService();
      const service = buildService(
        roleRepository,
        auditLogRepository,
        sessionSync,
      );

      await service.attachPolicies(
        MOCK_ROLE_ID,
        ['policy-existing', 'policy-new'],
        'actor-id',
      );

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role_id: MOCK_ROLE_ID,
          policy_id: 'policy-new',
          action: 'attached',
          created_by: 'actor-id',
        }),
      );
      expect(auditLogRepository.save).toHaveBeenCalled();
      expect(sessionSync.syncUsersByRole).toHaveBeenCalledWith(MOCK_ROLE_ID);
    });

    it('writes "detached" audit entries for removed policies', async () => {
      const existingRole = createMockRole({
        policies: [
          { id: 'policy-existing' } as never,
          { id: 'policy-to-remove' } as never,
        ],
      });
      const roleRepository = createMockRoleRepository(0);
      roleRepository.findOne.mockResolvedValue(existingRole);
      const auditLogRepository = createMockAuditLogRepository();
      const sessionSync = createMockSessionSyncService();
      const service = buildService(
        roleRepository,
        auditLogRepository,
        sessionSync,
      );

      await service.attachPolicies(
        MOCK_ROLE_ID,
        ['policy-existing'],
        'actor-id',
      );

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role_id: MOCK_ROLE_ID,
          policy_id: 'policy-to-remove',
          action: 'detached',
          created_by: 'actor-id',
        }),
      );
    });

    it('does not write audit entries or save when the policy set is unchanged', async () => {
      const existingRole = createMockRole({
        policies: [{ id: 'policy-existing' } as never],
      });
      const roleRepository = createMockRoleRepository(0);
      roleRepository.findOne.mockResolvedValue(existingRole);
      const auditLogRepository = createMockAuditLogRepository();
      const sessionSync = createMockSessionSyncService();
      const service = buildService(
        roleRepository,
        auditLogRepository,
        sessionSync,
      );

      await service.attachPolicies(
        MOCK_ROLE_ID,
        ['policy-existing'],
        'actor-id',
      );

      expect(auditLogRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findPolicyIds', () => {
    it('returns the ids of the policies attached to the role', async () => {
      const roleRepository = createMockRoleRepository(0);
      roleRepository.findOne.mockResolvedValue(
        createMockRole({ policies: [{ id: 'policy-1' } as never] }),
      );
      const auditLogRepository = createMockAuditLogRepository();
      const sessionSync = createMockSessionSyncService();
      const service = buildService(
        roleRepository,
        auditLogRepository,
        sessionSync,
      );

      const result = await service.findPolicyIds(MOCK_ROLE_ID);

      expect(result).toEqual(['policy-1']);
    });

    it('returns an empty array when the role does not exist', async () => {
      const roleRepository = createMockRoleRepository(0);
      roleRepository.findOne.mockResolvedValue(null);
      const auditLogRepository = createMockAuditLogRepository();
      const sessionSync = createMockSessionSyncService();
      const service = buildService(
        roleRepository,
        auditLogRepository,
        sessionSync,
      );

      const result = await service.findPolicyIds(MOCK_ROLE_ID);

      expect(result).toEqual([]);
    });
  });
});
