import type { Repository } from 'typeorm';

import { ConfigService } from '@lib/config';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { SessionStoreService } from '@lib/common/services/session-store.service';

import { Role } from '@apps/iam/src/modules/roles/entities/role.entity';
import { User } from '@apps/iam/src/modules/users/entities/user.entity';

import { SessionSyncService } from '@apps/iam/src/modules/access/services/session-sync.service';
import { PermissionResolverService } from '@apps/iam/src/modules/access/services/permission-resolver.service';
import type { IPermissionResolution } from '@apps/iam/src/modules/access/services/permission-resolver.service';

import { createMockUser } from '@apps/iam/test/mocks/mock-iam-access';

type MockUserRepo = {
  find: jest.Mock<Promise<User[]>, [unknown]>;
};
type MockRoleRepo = {
  find: jest.Mock<Promise<Role[]>, [unknown]>;
};
type MockPermissionResolverService = {
  resolveForUser: jest.Mock<Promise<IPermissionResolution>, [string]>;
};
type MockSessionStoreService = {
  refreshPermissionsForUser: jest.Mock<
    Promise<void>,
    [string, IPermissionResolution]
  >;
};
type MockLogsService = {
  setContext: jest.Mock<void, [string, string | undefined]>;
  error: jest.Mock<void, [string, Error, Record<string, unknown>?]>;
};

function createMockUserRepo(): MockUserRepo {
  return { find: jest.fn<Promise<User[]>, [unknown]>() };
}
function createMockRoleRepo(): MockRoleRepo {
  return { find: jest.fn<Promise<Role[]>, [unknown]>() };
}
function createMockPermissionResolverService(): MockPermissionResolverService {
  return {
    resolveForUser: jest
      .fn<Promise<IPermissionResolution>, [string]>()
      .mockResolvedValue({
        roles: [],
        permissions: [],
        conditional_permissions: [],
      }),
  };
}
function createMockSessionStoreService(): MockSessionStoreService {
  return {
    refreshPermissionsForUser: jest
      .fn<Promise<void>, [string, IPermissionResolution]>()
      .mockResolvedValue(undefined),
  };
}
function createMockLogsService(): MockLogsService {
  return {
    setContext: jest.fn<void, [string, string | undefined]>(),
    error: jest.fn<void, [string, Error, Record<string, unknown>?]>(),
  };
}
function createMockConfigService(): ConfigService {
  const values: Record<string, string> = {
    IAM_PREFIX_NAME: 'iam',
    IAM_PREFIX_VERSION: '1.0.0',
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('SessionSyncService', () => {
  let userRepo: MockUserRepo;
  let roleRepo: MockRoleRepo;
  let permissionResolver: MockPermissionResolverService;
  let sessionStore: MockSessionStoreService;
  let logger: MockLogsService;
  let service: SessionSyncService;

  beforeEach(() => {
    userRepo = createMockUserRepo();
    roleRepo = createMockRoleRepo();
    permissionResolver = createMockPermissionResolverService();
    sessionStore = createMockSessionStoreService();
    logger = createMockLogsService();

    service = new SessionSyncService(
      logger as unknown as LogsService,
      createMockConfigService(),
      permissionResolver as unknown as PermissionResolverService,
      sessionStore as unknown as SessionStoreService,
      userRepo as unknown as Repository<User>,
      roleRepo as unknown as Repository<Role>,
    );
  });

  describe('syncUser', () => {
    it('resolves permissions and pushes them into the session store', async () => {
      const resolution: IPermissionResolution = {
        roles: ['ROLE_ADMIN'],
        permissions: ['inventory:read'],
        conditional_permissions: [],
      };
      permissionResolver.resolveForUser.mockResolvedValue(resolution);

      await service.syncUser('user-1');

      expect(permissionResolver.resolveForUser).toHaveBeenCalledWith('user-1');
      expect(sessionStore.refreshPermissionsForUser).toHaveBeenCalledWith(
        'user-1',
        resolution,
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('swallows errors from the resolver/session store and logs instead of throwing', async () => {
      permissionResolver.resolveForUser.mockRejectedValue(
        new Error('resolve failed'),
      );

      await expect(service.syncUser('user-1')).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to sync live sessions after a permission change.',
        expect.any(Error),
        { user_id: 'user-1' },
      );
    });

    it('swallows errors thrown by the session store write', async () => {
      permissionResolver.resolveForUser.mockResolvedValue({
        roles: [],
        permissions: [],
        conditional_permissions: [],
      });
      sessionStore.refreshPermissionsForUser.mockRejectedValue(
        new Error('redis down'),
      );

      await expect(service.syncUser('user-1')).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('syncUsersByRole', () => {
    it('resyncs every user holding the given role', async () => {
      const userA = createMockUser({ id: 'user-a' });
      const userB = createMockUser({ id: 'user-b' });
      userRepo.find.mockResolvedValue([userA, userB]);

      await service.syncUsersByRole('role-1');

      expect(userRepo.find).toHaveBeenCalledWith({
        where: { roles: { id: 'role-1' } },
      });
      expect(permissionResolver.resolveForUser).toHaveBeenCalledWith('user-a');
      expect(permissionResolver.resolveForUser).toHaveBeenCalledWith('user-b');
    });

    it('does nothing (no sync calls) when no users hold the role', async () => {
      userRepo.find.mockResolvedValue([]);

      await service.syncUsersByRole('role-1');

      expect(permissionResolver.resolveForUser).not.toHaveBeenCalled();
    });
  });

  describe('syncUsersByPolicy', () => {
    it('short-circuits without touching users when no role references the policy', async () => {
      roleRepo.find.mockResolvedValue([]);

      await service.syncUsersByPolicy('policy-1');

      expect(userRepo.find).not.toHaveBeenCalled();
      expect(permissionResolver.resolveForUser).not.toHaveBeenCalled();
    });

    it('resyncs every user reachable via role -> policy, deduplicated', async () => {
      roleRepo.find.mockResolvedValue([
        { id: 'role-1' } as Role,
        { id: 'role-2' } as Role,
      ]);
      const sharedUser = createMockUser({ id: 'user-shared' });
      userRepo.find.mockResolvedValue([sharedUser, sharedUser]);

      await service.syncUsersByPolicy('policy-1');

      expect(roleRepo.find).toHaveBeenCalledWith({
        where: { policies: { id: 'policy-1' } },
      });
      expect(permissionResolver.resolveForUser).toHaveBeenCalledTimes(1);
      expect(permissionResolver.resolveForUser).toHaveBeenCalledWith(
        'user-shared',
      );
    });
  });
});
