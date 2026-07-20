import { NotFoundException } from '@nestjs/common';

import type { Repository } from 'typeorm';

import type {
  IEvaluateConditionsPayload,
  IFindByIdPayload,
  IIamUser,
  IResolvePermissionsPayload,
} from '@lib/common/constants/iam-message-patterns';
import type { IMicroservicePayload } from '@lib/common/interfaces/microservice.interface';

import { AccessEventsController } from '@apps/iam/src/modules/access/controllers/access-events.controller';
import { User } from '@apps/iam/src/modules/users/entities/user.entity';
import { PermissionResolverService } from '@apps/iam/src/modules/access/services/permission-resolver.service';
import type { IPermissionResolution } from '@apps/iam/src/modules/access/services/permission-resolver.service';

import { createMockUser } from '@apps/iam/test/mocks/mock-iam-access';

type MockUserRepo = {
  findOne: jest.Mock<Promise<User | null>, [unknown]>;
};
type MockPermissionResolverService = {
  resolveForUser: jest.Mock<Promise<IPermissionResolution>, [string]>;
  evaluate: jest.Mock<
    Promise<boolean>,
    [string, string, string, Record<string, string>]
  >;
};

function createMockUserRepo(): MockUserRepo {
  return { findOne: jest.fn<Promise<User | null>, [unknown]>() };
}
function createMockPermissionResolverService(): MockPermissionResolverService {
  return {
    resolveForUser: jest.fn<Promise<IPermissionResolution>, [string]>(),
    evaluate: jest.fn<
      Promise<boolean>,
      [string, string, string, Record<string, string>]
    >(),
  };
}

function wrap<T>(payload: T): IMicroservicePayload<T> {
  return { payload } as IMicroservicePayload<T>;
}

describe('AccessEventsController', () => {
  let userRepo: MockUserRepo;
  let permissionResolver: MockPermissionResolverService;
  let controller: AccessEventsController;

  beforeEach(() => {
    userRepo = createMockUserRepo();
    permissionResolver = createMockPermissionResolverService();
    controller = new AccessEventsController(
      userRepo as unknown as Repository<User>,
      permissionResolver as unknown as PermissionResolverService,
    );
  });

  describe('findById', () => {
    it('returns the mapped IIamUser shape for an existing, non-deleted user', async () => {
      const user = createMockUser({
        id: 'user-1',
        username: 'jdoe',
        email: 'jdoe@example.com',
        full_name: 'John Doe',
        department: 'IT',
        status: 'active',
      });
      userRepo.findOne.mockResolvedValue(user);

      const payload: IFindByIdPayload = { user_id: 'user-1' };
      const result = await controller.findById(wrap(payload));

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1', is_deleted: false },
      });
      const expected: IIamUser = {
        id: 'user-1',
        username: 'jdoe',
        email: 'jdoe@example.com',
        full_name: 'John Doe',
        department: 'IT',
        status: 'active',
      };
      expect(result).toEqual(expected);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const payload: IFindByIdPayload = { user_id: 'missing-user' };

      await expect(controller.findById(wrap(payload))).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.findById(wrap(payload))).rejects.toThrow(
        "User 'missing-user' not found.",
      );
    });
  });

  describe('resolvePermissions', () => {
    it('delegates to permissionResolver.resolveForUser', async () => {
      const resolution: IPermissionResolution = {
        roles: ['ROLE_ADMIN'],
        permissions: ['inventory:read'],
        conditional_permissions: [],
      };
      permissionResolver.resolveForUser.mockResolvedValue(resolution);

      const payload: IResolvePermissionsPayload = { user_id: 'user-1' };
      const result = await controller.resolvePermissions(wrap(payload));

      expect(permissionResolver.resolveForUser).toHaveBeenCalledWith('user-1');
      expect(result).toBe(resolution);
    });
  });

  describe('evaluateConditions', () => {
    it('delegates to permissionResolver.evaluate with a joined resource:action permission string', async () => {
      permissionResolver.evaluate.mockResolvedValue(true);

      const payload: IEvaluateConditionsPayload = {
        user_id: 'user-1',
        service: 'inventory-bc',
        resource: 'inventory',
        action: 'read',
        context: { 'context.department': 'IT' },
      };
      const result = await controller.evaluateConditions(wrap(payload));

      expect(permissionResolver.evaluate).toHaveBeenCalledWith(
        'user-1',
        'inventory-bc',
        'inventory:read',
        { 'context.department': 'IT' },
      );
      expect(result).toBe(true);
    });

    it('returns false when the resolver denies the condition', async () => {
      permissionResolver.evaluate.mockResolvedValue(false);

      const payload: IEvaluateConditionsPayload = {
        user_id: 'user-1',
        service: 'inventory-bc',
        resource: 'inventory',
        action: 'delete',
        context: {},
      };
      const result = await controller.evaluateConditions(wrap(payload));

      expect(result).toBe(false);
    });
  });
});
