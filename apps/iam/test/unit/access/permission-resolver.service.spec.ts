import type { Repository } from 'typeorm';

import { Permission } from '@apps/iam/src/modules/permissions/entities/permission.entity';
import { PolicyStatement } from '@apps/iam/src/modules/policies/entities/policy-statement.entity';
import { Policy } from '@apps/iam/src/modules/policies/entities/policy.entity';
import { StatementAction } from '@apps/iam/src/modules/policies/entities/statement-action.entity';
import type { ConditionOperator } from '@apps/iam/src/modules/policies/entities/statement-condition.entity';
import { StatementCondition } from '@apps/iam/src/modules/policies/entities/statement-condition.entity';
import { StatementTarget } from '@apps/iam/src/modules/policies/entities/statement-target.entity';
import { Role } from '@apps/iam/src/modules/roles/entities/role.entity';
import { User } from '@apps/iam/src/modules/users/entities/user.entity';

import { PermissionResolverService } from '@apps/iam/src/modules/access/services/permission-resolver.service';

import {
  createMockPermission,
  createMockPolicy,
  createMockPolicyStatement,
  createMockRole,
  createMockStatementAction,
  createMockStatementCondition,
  createMockUser,
} from '@apps/iam/test/mocks/mock-iam-access';

type MockRepo<T> = {
  findOne: jest.Mock<Promise<T | null>, [unknown]>;
  find: jest.Mock<Promise<T[]>, [unknown]>;
};

function createMockRepo<T>(): MockRepo<T> {
  return {
    findOne: jest.fn<Promise<T | null>, [unknown]>(),
    find: jest.fn<Promise<T[]>, [unknown]>(),
  };
}

describe('PermissionResolverService', () => {
  let userRepo: MockRepo<User>;
  let roleRepo: MockRepo<Role>;
  let policyRepo: MockRepo<Policy>;
  let statementRepo: MockRepo<PolicyStatement>;
  let targetRepo: MockRepo<StatementTarget>;
  let actionRepo: MockRepo<StatementAction>;
  let conditionRepo: MockRepo<StatementCondition>;
  let permissionRepo: MockRepo<Permission>;
  let service: PermissionResolverService;

  beforeEach(() => {
    userRepo = createMockRepo<User>();
    roleRepo = createMockRepo<Role>();
    policyRepo = createMockRepo<Policy>();
    statementRepo = createMockRepo<PolicyStatement>();
    targetRepo = createMockRepo<StatementTarget>();
    actionRepo = createMockRepo<StatementAction>();
    conditionRepo = createMockRepo<StatementCondition>();
    permissionRepo = createMockRepo<Permission>();

    service = new PermissionResolverService(
      userRepo as unknown as Repository<User>,
      roleRepo as unknown as Repository<Role>,
      policyRepo as unknown as Repository<Policy>,
      statementRepo as unknown as Repository<PolicyStatement>,
      targetRepo as unknown as Repository<StatementTarget>,
      actionRepo as unknown as Repository<StatementAction>,
      conditionRepo as unknown as Repository<StatementCondition>,
      permissionRepo as unknown as Repository<Permission>,
    );
  });

  describe('resolveForUser', () => {
    it('returns empty sets when the user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.resolveForUser('missing-user');

      expect(result).toEqual({
        roles: [],
        permissions: [],
        conditional_permissions: [],
      });
      expect(roleRepo.find).not.toHaveBeenCalled();
    });

    it('returns empty sets when the user has no roles', async () => {
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [] }));

      const result = await service.resolveForUser('user-1');

      expect(result).toEqual({
        roles: [],
        permissions: [],
        conditional_permissions: [],
      });
    });

    it('returns role codes with empty permissions when roles have no policies', async () => {
      const role = createMockRole({ policies: [] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);

      const result = await service.resolveForUser('user-1');

      expect(result).toEqual({
        roles: [role.code],
        permissions: [],
        conditional_permissions: [],
      });
      expect(policyRepo.find).not.toHaveBeenCalled();
    });

    it('resolves allow permissions and excludes inactive policies', async () => {
      const policy = createMockPolicy({ id: 'policy-1', is_active: true });
      const role = createMockRole({ policies: [policy] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);
      policyRepo.find.mockResolvedValue([policy]);

      const statement = createMockPolicyStatement({
        id: 'stmt-1',
        effect: 'allow',
      });
      statementRepo.find.mockResolvedValue([statement]);
      targetRepo.find.mockResolvedValue([]);
      actionRepo.find.mockResolvedValue([
        createMockStatementAction({
          statement_id: 'stmt-1',
          permission_id: 'perm-1',
        }),
      ]);
      conditionRepo.find.mockResolvedValue([]);
      permissionRepo.find.mockResolvedValue([
        createMockPermission({ id: 'perm-1', permission: 'inventory:read' }),
      ]);

      const result = await service.resolveForUser('user-1');

      expect(result).toEqual({
        roles: [role.code],
        permissions: ['inventory:read'],
        conditional_permissions: [],
      });
    });

    it('applies deny-override so a denied permission is excluded even if also allowed', async () => {
      const policy = createMockPolicy({ id: 'policy-1' });
      const role = createMockRole({ policies: [policy] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);
      policyRepo.find.mockResolvedValue([policy]);

      const allowStatement = createMockPolicyStatement({
        id: 'stmt-allow',
        effect: 'allow',
      });
      const denyStatement = createMockPolicyStatement({
        id: 'stmt-deny',
        effect: 'deny',
      });
      statementRepo.find.mockResolvedValue([allowStatement, denyStatement]);
      targetRepo.find.mockResolvedValue([]);
      actionRepo.find.mockResolvedValue([
        createMockStatementAction({
          statement_id: 'stmt-allow',
          permission_id: 'perm-1',
        }),
        createMockStatementAction({
          id: 'action-2',
          statement_id: 'stmt-deny',
          permission_id: 'perm-1',
        }),
      ]);
      conditionRepo.find.mockResolvedValue([]);
      permissionRepo.find.mockResolvedValue([
        createMockPermission({ id: 'perm-1', permission: 'inventory:delete' }),
      ]);

      const result = await service.resolveForUser('user-1');

      expect(result.permissions).toEqual([]);
    });

    it('puts a permission in conditional_permissions when its statement has conditions, excluding it from the unconditional set', async () => {
      const policy = createMockPolicy({ id: 'policy-1' });
      const role = createMockRole({ policies: [policy] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);
      policyRepo.find.mockResolvedValue([policy]);

      const statement = createMockPolicyStatement({
        id: 'stmt-1',
        effect: 'allow',
      });
      statementRepo.find.mockResolvedValue([statement]);
      targetRepo.find.mockResolvedValue([]);
      actionRepo.find.mockResolvedValue([
        createMockStatementAction({
          statement_id: 'stmt-1',
          permission_id: 'perm-1',
        }),
      ]);
      conditionRepo.find.mockResolvedValue([
        createMockStatementCondition({ statement_id: 'stmt-1' }),
      ]);
      permissionRepo.find.mockResolvedValue([
        createMockPermission({ id: 'perm-1', permission: 'inventory:approve' }),
      ]);

      const result = await service.resolveForUser('user-1');

      expect(result.permissions).toEqual([]);
      expect(result.conditional_permissions).toEqual(['inventory:approve']);
    });

    it('deduplicates role ids and policy ids across multiple roles', async () => {
      const sharedRole = createMockRole({ id: 'role-1' });
      userRepo.findOne.mockResolvedValue(
        createMockUser({ roles: [sharedRole, sharedRole] }),
      );
      roleRepo.find.mockResolvedValue([sharedRole]);
      policyRepo.find.mockResolvedValue([]);

      await service.resolveForUser('user-1');

      expect(roleRepo.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveForPolicyIds', () => {
    it('returns empty sets for an empty policyIds array without querying the DB', async () => {
      const result = await service.resolveForPolicyIds([]);

      expect(result).toEqual({ permissions: [], conditional_permissions: [] });
      expect(policyRepo.find).not.toHaveBeenCalled();
    });

    it('returns empty sets when none of the policies are active', async () => {
      policyRepo.find.mockResolvedValue([]);

      const result = await service.resolveForPolicyIds(['policy-1']);

      expect(result).toEqual({ permissions: [], conditional_permissions: [] });
      expect(statementRepo.find).not.toHaveBeenCalled();
    });

    it('resolves permissions for the given active policy ids', async () => {
      const policy = createMockPolicy({ id: 'policy-1' });
      policyRepo.find.mockResolvedValue([policy]);
      const statement = createMockPolicyStatement({
        id: 'stmt-1',
        effect: 'allow',
      });
      statementRepo.find.mockResolvedValue([statement]);
      targetRepo.find.mockResolvedValue([]);
      actionRepo.find.mockResolvedValue([
        createMockStatementAction({
          statement_id: 'stmt-1',
          permission_id: 'perm-1',
        }),
      ]);
      conditionRepo.find.mockResolvedValue([]);
      permissionRepo.find.mockResolvedValue([
        createMockPermission({ id: 'perm-1', permission: 'inventory:read' }),
      ]);

      const result = await service.resolveForPolicyIds(['policy-1']);

      expect(result).toEqual({
        permissions: ['inventory:read'],
        conditional_permissions: [],
      });
    });
  });

  describe('evaluate', () => {
    it('returns false when the user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.evaluate(
        'missing-user',
        'inventory-bc',
        'inventory:read',
        {},
      );

      expect(result).toBe(false);
    });

    it('returns false when the user has no roles', async () => {
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [] }));

      const result = await service.evaluate(
        'user-1',
        'inventory-bc',
        'inventory:read',
        {},
      );

      expect(result).toBe(false);
    });

    it('returns false when roles resolve to no policies', async () => {
      const role = createMockRole({ policies: [] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);

      const result = await service.evaluate(
        'user-1',
        'inventory-bc',
        'inventory:read',
        {},
      );

      expect(result).toBe(false);
    });

    it('returns true when an allow statement matches and its conditions hold', async () => {
      const policy = createMockPolicy({ id: 'policy-1' });
      const role = createMockRole({ policies: [policy] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);
      policyRepo.find.mockResolvedValue([policy]);

      const statement = createMockPolicyStatement({
        id: 'stmt-1',
        effect: 'allow',
      });
      statementRepo.find.mockResolvedValue([statement]);
      targetRepo.find.mockResolvedValue([]);
      actionRepo.find.mockResolvedValue([
        createMockStatementAction({
          statement_id: 'stmt-1',
          permission_id: 'perm-1',
        }),
      ]);
      conditionRepo.find.mockResolvedValue([
        createMockStatementCondition({
          statement_id: 'stmt-1',
          operator: 'StringEquals',
          condition_key: 'context.department',
          condition_value: 'IT',
        }),
      ]);
      permissionRepo.find.mockResolvedValue([
        createMockPermission({ id: 'perm-1', permission: 'inventory:approve' }),
      ]);

      const result = await service.evaluate(
        'user-1',
        'inventory-bc',
        'inventory:approve',
        {
          'context.department': 'IT',
        },
      );

      expect(result).toBe(true);
    });

    it('returns false when the allow statement condition does not hold', async () => {
      const policy = createMockPolicy({ id: 'policy-1' });
      const role = createMockRole({ policies: [policy] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);
      policyRepo.find.mockResolvedValue([policy]);

      const statement = createMockPolicyStatement({
        id: 'stmt-1',
        effect: 'allow',
      });
      statementRepo.find.mockResolvedValue([statement]);
      targetRepo.find.mockResolvedValue([]);
      actionRepo.find.mockResolvedValue([
        createMockStatementAction({
          statement_id: 'stmt-1',
          permission_id: 'perm-1',
        }),
      ]);
      conditionRepo.find.mockResolvedValue([
        createMockStatementCondition({
          statement_id: 'stmt-1',
          operator: 'StringEquals',
          condition_key: 'context.department',
          condition_value: 'IT',
        }),
      ]);
      permissionRepo.find.mockResolvedValue([
        createMockPermission({ id: 'perm-1', permission: 'inventory:approve' }),
      ]);

      const result = await service.evaluate(
        'user-1',
        'inventory-bc',
        'inventory:approve',
        {
          'context.department': 'HR',
        },
      );

      expect(result).toBe(false);
    });

    it('denies (deny-override) when a matching deny statement condition holds even though an allow also matches', async () => {
      const policy = createMockPolicy({ id: 'policy-1' });
      const role = createMockRole({ policies: [policy] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);
      policyRepo.find.mockResolvedValue([policy]);

      const allowStatement = createMockPolicyStatement({
        id: 'stmt-allow',
        effect: 'allow',
      });
      const denyStatement = createMockPolicyStatement({
        id: 'stmt-deny',
        effect: 'deny',
      });
      statementRepo.find.mockResolvedValue([allowStatement, denyStatement]);
      targetRepo.find.mockResolvedValue([]);
      actionRepo.find.mockResolvedValue([
        createMockStatementAction({
          statement_id: 'stmt-allow',
          permission_id: 'perm-1',
        }),
        createMockStatementAction({
          id: 'action-2',
          statement_id: 'stmt-deny',
          permission_id: 'perm-1',
        }),
      ]);
      conditionRepo.find.mockResolvedValue([]);
      permissionRepo.find.mockResolvedValue([
        createMockPermission({ id: 'perm-1', permission: 'inventory:delete' }),
      ]);

      const result = await service.evaluate(
        'user-1',
        'inventory-bc',
        'inventory:delete',
        {},
      );

      expect(result).toBe(false);
    });

    it('evaluates the ${user.id} placeholder against the actual user id', async () => {
      const policy = createMockPolicy({ id: 'policy-1' });
      const role = createMockRole({ policies: [policy] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);
      policyRepo.find.mockResolvedValue([policy]);

      const statement = createMockPolicyStatement({
        id: 'stmt-1',
        effect: 'allow',
      });
      statementRepo.find.mockResolvedValue([statement]);
      targetRepo.find.mockResolvedValue([]);
      actionRepo.find.mockResolvedValue([
        createMockStatementAction({
          statement_id: 'stmt-1',
          permission_id: 'perm-1',
        }),
      ]);
      conditionRepo.find.mockResolvedValue([
        createMockStatementCondition({
          statement_id: 'stmt-1',
          operator: 'StringEquals',
          condition_key: 'customer.owner_id',
          condition_value: '${user.id}',
        }),
      ]);
      permissionRepo.find.mockResolvedValue([
        createMockPermission({ id: 'perm-1', permission: 'order:edit' }),
      ]);

      const result = await service.evaluate(
        'user-42',
        'sales-bc',
        'order:edit',
        {
          'customer.owner_id': 'user-42',
        },
      );

      expect(result).toBe(true);
    });

    it('returns false for an unrecognized operator', async () => {
      const policy = createMockPolicy({ id: 'policy-1' });
      const role = createMockRole({ policies: [policy] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);
      policyRepo.find.mockResolvedValue([policy]);

      const statement = createMockPolicyStatement({
        id: 'stmt-1',
        effect: 'allow',
      });
      statementRepo.find.mockResolvedValue([statement]);
      targetRepo.find.mockResolvedValue([]);
      actionRepo.find.mockResolvedValue([
        createMockStatementAction({
          statement_id: 'stmt-1',
          permission_id: 'perm-1',
        }),
      ]);
      conditionRepo.find.mockResolvedValue([
        createMockStatementCondition({
          statement_id: 'stmt-1',
          operator: 'Unknown' as unknown as ConditionOperator,
          condition_key: 'foo',
          condition_value: 'bar',
        }),
      ]);
      permissionRepo.find.mockResolvedValue([
        createMockPermission({ id: 'perm-1', permission: 'order:edit' }),
      ]);

      const result = await service.evaluate(
        'user-1',
        'sales-bc',
        'order:edit',
        { foo: 'bar' },
      );

      expect(result).toBe(false);
    });

    it('returns false when the context does not include the condition key', async () => {
      const policy = createMockPolicy({ id: 'policy-1' });
      const role = createMockRole({ policies: [policy] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);
      policyRepo.find.mockResolvedValue([policy]);

      const statement = createMockPolicyStatement({
        id: 'stmt-1',
        effect: 'allow',
      });
      statementRepo.find.mockResolvedValue([statement]);
      targetRepo.find.mockResolvedValue([]);
      actionRepo.find.mockResolvedValue([
        createMockStatementAction({
          statement_id: 'stmt-1',
          permission_id: 'perm-1',
        }),
      ]);
      conditionRepo.find.mockResolvedValue([
        createMockStatementCondition({
          statement_id: 'stmt-1',
          condition_key: 'context.missing',
        }),
      ]);
      permissionRepo.find.mockResolvedValue([
        createMockPermission({ id: 'perm-1', permission: 'order:edit' }),
      ]);

      const result = await service.evaluate(
        'user-1',
        'sales-bc',
        'order:edit',
        {},
      );

      expect(result).toBe(false);
    });

    it('returns false when no statement matches the requested permission', async () => {
      const policy = createMockPolicy({ id: 'policy-1' });
      const role = createMockRole({ policies: [policy] });
      userRepo.findOne.mockResolvedValue(createMockUser({ roles: [role] }));
      roleRepo.find.mockResolvedValue([role]);
      policyRepo.find.mockResolvedValue([policy]);

      const statement = createMockPolicyStatement({
        id: 'stmt-1',
        effect: 'allow',
      });
      statementRepo.find.mockResolvedValue([statement]);
      targetRepo.find.mockResolvedValue([]);
      actionRepo.find.mockResolvedValue([
        createMockStatementAction({
          statement_id: 'stmt-1',
          permission_id: 'perm-1',
        }),
      ]);
      conditionRepo.find.mockResolvedValue([]);
      permissionRepo.find.mockResolvedValue([
        createMockPermission({ id: 'perm-1', permission: 'order:view' }),
      ]);

      const result = await service.evaluate(
        'user-1',
        'sales-bc',
        'order:edit',
        {},
      );

      expect(result).toBe(false);
    });
  });
});
