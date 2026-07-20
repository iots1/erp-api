import { ConflictException } from '@nestjs/common';

import { Repository } from 'typeorm';

import { ConfigService } from '@lib/config';
import { LogsService } from '@lib/common/modules/log/logs.service';

import { SessionSyncService } from '@apps/iam/src/modules/access/services/session-sync.service';
import { PolicyStatement } from '@apps/iam/src/modules/policies/entities/policy-statement.entity';
import { StatementAction } from '@apps/iam/src/modules/policies/entities/statement-action.entity';
import { StatementCondition } from '@apps/iam/src/modules/policies/entities/statement-condition.entity';
import { StatementTarget } from '@apps/iam/src/modules/policies/entities/statement-target.entity';
import { Policy } from '@apps/iam/src/modules/policies/entities/policy.entity';
import { PolicyStatementInputDTO } from '@apps/iam/src/modules/policies/dto/set-statements.dto';
import { PoliciesService } from '@apps/iam/src/modules/policies/services/policies.service';

type MockQueryBuilder = {
  select: jest.Mock<MockQueryBuilder, [string]>;
  from: jest.Mock<MockQueryBuilder, [string, string]>;
  where: jest.Mock<MockQueryBuilder, [string, unknown]>;
  getCount: jest.Mock<Promise<number>, []>;
};

function createMockQueryBuilder(count: number): MockQueryBuilder {
  const qb: Partial<MockQueryBuilder> = {};
  qb.select = jest
    .fn<MockQueryBuilder, [string]>()
    .mockReturnValue(qb as MockQueryBuilder);
  qb.from = jest
    .fn<MockQueryBuilder, [string, string]>()
    .mockReturnValue(qb as MockQueryBuilder);
  qb.where = jest
    .fn<MockQueryBuilder, [string, unknown]>()
    .mockReturnValue(qb as MockQueryBuilder);
  qb.getCount = jest.fn<Promise<number>, []>().mockResolvedValue(count);
  return qb as MockQueryBuilder;
}

type MockPolicyRepository = {
  metadata: { tableName: string };
  manager: {
    createQueryBuilder: jest.Mock<MockQueryBuilder, []>;
    transaction: jest.Mock<
      Promise<unknown>,
      [(manager: unknown) => Promise<unknown>]
    >;
  };
};

function createMockPolicyRepository(
  queryBuilder: MockQueryBuilder,
): MockPolicyRepository {
  return {
    metadata: { tableName: 'policies' },
    manager: {
      createQueryBuilder: jest
        .fn<MockQueryBuilder, []>()
        .mockReturnValue(queryBuilder),
      transaction: jest.fn<
        Promise<unknown>,
        [(manager: unknown) => Promise<unknown>]
      >(),
    },
  };
}

type MockSimpleRepository = {
  find: jest.Mock<Promise<unknown[]>, [unknown]>;
  delete: jest.Mock<Promise<unknown>, [unknown]>;
  create: jest.Mock<unknown, [unknown]>;
  save: jest.Mock<Promise<unknown>, [unknown]>;
  createQueryBuilder: jest.Mock<unknown, [string]>;
};

function createMockSimpleRepository(): MockSimpleRepository {
  return {
    find: jest.fn<Promise<unknown[]>, [unknown]>().mockResolvedValue([]),
    delete: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(undefined),
    create: jest
      .fn<unknown, [unknown]>()
      .mockImplementation((input: unknown) => input),
    save: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn<unknown, [string]>(),
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

const POLICY_ID = 'e1e2e3e4-0000-4000-8000-000000000005';
const PERMISSION_ID = 'f1f2f3f4-0000-4000-8000-000000000006';

function buildStatementInput(
  overrides?: Partial<PolicyStatementInputDTO>,
): PolicyStatementInputDTO {
  return {
    effect: 'allow',
    plane: 'api',
    service: ['inventory-bc'],
    resource: ['goods_receipt'],
    permission_ids: [PERMISSION_ID],
    conditions: [],
    ...overrides,
  };
}

describe('PoliciesService (Unit)', () => {
  let service: PoliciesService;
  let mockQueryBuilder: MockQueryBuilder;
  let mockPolicyRepository: MockPolicyRepository;
  const mockStatementRepository = createMockSimpleRepository();
  const mockTargetRepository = createMockSimpleRepository();
  const mockActionRepository = createMockSimpleRepository();
  const mockConditionRepository = createMockSimpleRepository();
  const mockSessionSync = createMockSessionSyncService();
  const mockLogger = createMockLogsService();
  const mockConfigService = createMockConfigService();

  function setup(attachedRoleCount = 0): void {
    mockQueryBuilder = createMockQueryBuilder(attachedRoleCount);
    mockPolicyRepository = createMockPolicyRepository(mockQueryBuilder);

    service = new PoliciesService(
      mockLogger as unknown as LogsService,
      mockConfigService as unknown as ConfigService,
      mockPolicyRepository as unknown as Repository<Policy>,
      mockStatementRepository as unknown as Repository<PolicyStatement>,
      mockTargetRepository as unknown as Repository<StatementTarget>,
      mockActionRepository as unknown as Repository<StatementAction>,
      mockConditionRepository as unknown as Repository<StatementCondition>,
      mockSessionSync as unknown as SessionSyncService,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('iam');
    mockSessionSync.syncUsersByPolicy.mockResolvedValue(undefined);
  });

  describe('delete', () => {
    it('throws ConflictException when the policy is still attached to a role', async () => {
      setup(1);

      await expect(service.delete(POLICY_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'rp.policy_id = :policyId',
        { policyId: POLICY_ID },
      );
    });

    it('delegates to the base delete when no role is attached', async () => {
      setup(0);
      const baseDeleteSpy = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(service)) as {
            delete: (...args: unknown[]) => Promise<void>;
          },
          'delete',
        )
        .mockResolvedValue(undefined);

      await service.delete(POLICY_ID, true, 'actor-id');

      expect(baseDeleteSpy).toHaveBeenCalledWith(POLICY_ID, true, 'actor-id');
      baseDeleteSpy.mockRestore();
    });
  });

  describe('setStatements', () => {
    it('replaces statements/targets/actions/conditions in a transaction and syncs sessions', async () => {
      setup(0);

      const statementEntity = { id: 'statement-1' };
      const txStatementRepo = createMockSimpleRepository();
      txStatementRepo.create.mockReturnValue({
        policy_id: POLICY_ID,
      });
      txStatementRepo.save.mockResolvedValue(statementEntity);

      const txTargetRepo = createMockSimpleRepository();
      const txActionRepo = createMockSimpleRepository();
      const txConditionRepo = createMockSimpleRepository();

      const txManager = {
        getRepository: jest
          .fn<unknown, [unknown]>()
          .mockImplementation((entity: unknown) => {
            if (entity === PolicyStatement) return txStatementRepo;
            if (entity === StatementTarget) return txTargetRepo;
            if (entity === StatementAction) return txActionRepo;
            if (entity === StatementCondition) return txConditionRepo;
            throw new Error('Unexpected repository requested');
          }),
      };

      mockPolicyRepository.manager.transaction.mockImplementation(
        async (fn: (manager: unknown) => Promise<unknown>) => fn(txManager),
      );

      const input = buildStatementInput({
        conditions: [
          {
            operator: 'StringEquals',
            condition_key: 'k',
            condition_value: 'v',
          },
        ],
      });

      await service.setStatements(POLICY_ID, [input], 'actor-id');

      expect(txStatementRepo.delete).toHaveBeenCalledWith({
        policy_id: POLICY_ID,
      });
      expect(txStatementRepo.save).toHaveBeenCalled();
      expect(txTargetRepo.save).toHaveBeenCalled();
      expect(txActionRepo.save).toHaveBeenCalled();
      expect(txConditionRepo.save).toHaveBeenCalled();
      expect(mockSessionSync.syncUsersByPolicy).toHaveBeenCalledWith(POLICY_ID);
    });

    it('skips saving conditions when a statement has none', async () => {
      setup(0);

      const statementEntity = { id: 'statement-1' };
      const txStatementRepo = createMockSimpleRepository();
      txStatementRepo.save.mockResolvedValue(statementEntity);
      const txTargetRepo = createMockSimpleRepository();
      const txActionRepo = createMockSimpleRepository();
      const txConditionRepo = createMockSimpleRepository();

      const txManager = {
        getRepository: jest
          .fn<unknown, [unknown]>()
          .mockImplementation((entity: unknown) => {
            if (entity === PolicyStatement) return txStatementRepo;
            if (entity === StatementTarget) return txTargetRepo;
            if (entity === StatementAction) return txActionRepo;
            if (entity === StatementCondition) return txConditionRepo;
            throw new Error('Unexpected repository requested');
          }),
      };

      mockPolicyRepository.manager.transaction.mockImplementation(
        async (fn: (manager: unknown) => Promise<unknown>) => fn(txManager),
      );

      const input = buildStatementInput({ conditions: [] });

      await service.setStatements(POLICY_ID, [input]);

      expect(txConditionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getStatements', () => {
    it('returns an expanded statement tree assembled from targets/actions/conditions', async () => {
      setup(0);

      const statement = {
        id: 'statement-1',
        effect: 'allow',
        plane: 'api',
      };
      mockStatementRepository.find.mockResolvedValue([statement]);
      mockTargetRepository.find.mockResolvedValue([
        { service: 'inventory-bc', resource: 'goods_receipt' },
      ]);
      mockConditionRepository.find.mockResolvedValue([
        { operator: 'StringEquals', condition_key: 'k', condition_value: 'v' },
      ]);

      const actionQueryBuilder = {
        innerJoinAndSelect: jest.fn<unknown, [string, string, string]>(),
        where: jest.fn<unknown, [string, unknown]>(),
        select: jest.fn<unknown, [string[]]>(),
        getRawMany: jest
          .fn<Promise<{ permission: string }[]>, []>()
          .mockResolvedValue([
            { permission: 'inventory-bc:goods_receipt:read' },
          ]),
      };
      actionQueryBuilder.innerJoinAndSelect.mockReturnValue(actionQueryBuilder);
      actionQueryBuilder.where.mockReturnValue(actionQueryBuilder);
      actionQueryBuilder.select.mockReturnValue(actionQueryBuilder);
      mockActionRepository.createQueryBuilder.mockReturnValue(
        actionQueryBuilder,
      );

      const result = await service.getStatements(POLICY_ID);

      expect(result).toEqual([
        {
          id: 'statement-1',
          effect: 'allow',
          plane: 'api',
          targets: [{ service: 'inventory-bc', resource: 'goods_receipt' }],
          permissions: ['inventory-bc:goods_receipt:read'],
          conditions: [
            {
              operator: 'StringEquals',
              condition_key: 'k',
              condition_value: 'v',
            },
          ],
        },
      ]);
    });

    it('returns an empty array when the policy has no statements', async () => {
      setup(0);
      mockStatementRepository.find.mockResolvedValue([]);

      const result = await service.getStatements(POLICY_ID);

      expect(result).toEqual([]);
    });
  });
});
