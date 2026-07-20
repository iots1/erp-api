import { Test, TestingModule } from '@nestjs/testing';

import type { IUserSession } from '@lib/common';
import type { IResponsePaginatedService } from '@lib/common';
import type { QueryParamsDTO } from '@lib/common/dto/query-params.dto';

import { PoliciesController } from '@apps/iam/src/modules/policies/controllers/policies.controller';
import {
  IExpandedStatement,
  PoliciesService,
} from '@apps/iam/src/modules/policies/services/policies.service';
import { CreatePolicyDTO } from '@apps/iam/src/modules/policies/dto/create-policy.dto';
import { UpdatePolicyDTO } from '@apps/iam/src/modules/policies/dto/update-policy.dto';
import { SetStatementsDTO } from '@apps/iam/src/modules/policies/dto/set-statements.dto';
import { Policy } from '@apps/iam/src/modules/policies/entities/policy.entity';

import { createMockPolicy } from '../../mocks/mock-policy';
import { createMockUserSession } from '../../mocks/mock-user-session';

type MockPoliciesService = {
  create: jest.Mock<Promise<Policy>, [CreatePolicyDTO, IUserSession]>;
  findPaginated: jest.Mock<
    Promise<IResponsePaginatedService<Policy[]>>,
    [QueryParamsDTO]
  >;
  findById: jest.Mock<Promise<Policy>, [string]>;
  update: jest.Mock<Promise<Policy>, [string, UpdatePolicyDTO, IUserSession]>;
  delete: jest.Mock<Promise<void>, [string, boolean, IUserSession]>;
  getStatements: jest.Mock<Promise<IExpandedStatement[]>, [string]>;
  setStatements: jest.Mock<
    Promise<void>,
    [string, SetStatementsDTO['statements'], string | undefined]
  >;
};

function createMockPoliciesService(): MockPoliciesService {
  return {
    create: jest.fn<Promise<Policy>, [CreatePolicyDTO, IUserSession]>(),
    findPaginated: jest.fn<
      Promise<IResponsePaginatedService<Policy[]>>,
      [QueryParamsDTO]
    >(),
    findById: jest.fn<Promise<Policy>, [string]>(),
    update: jest.fn<Promise<Policy>, [string, UpdatePolicyDTO, IUserSession]>(),
    delete: jest.fn<Promise<void>, [string, boolean, IUserSession]>(),
    getStatements: jest.fn<Promise<IExpandedStatement[]>, [string]>(),
    setStatements: jest.fn<
      Promise<void>,
      [string, SetStatementsDTO['statements'], string | undefined]
    >(),
  };
}

const POLICY_ID = 'e1e2e3e4-0000-4000-8000-000000000005';

describe('PoliciesController (Unit)', () => {
  let controller: PoliciesController;
  const mockPoliciesService = createMockPoliciesService();
  const mockCurrentUser: IUserSession = createMockUserSession();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PoliciesController],
      providers: [{ provide: PoliciesService, useValue: mockPoliciesService }],
    }).compile();

    controller = module.get<PoliciesController>(PoliciesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() delegates to service.create', async () => {
    const dto: CreatePolicyDTO = {
      code: 'POL_TEST',
      name_th: 'ทดสอบ',
      name_en: 'Test',
      is_active: true,
    };
    const created = createMockPolicy();
    mockPoliciesService.create.mockResolvedValue(created);

    const result = await controller.create(dto, mockCurrentUser);

    expect(mockPoliciesService.create).toHaveBeenCalledWith(
      dto,
      mockCurrentUser,
    );
    expect(result).toBe(created);
  });

  it('findPaginated() delegates to service.findPaginated', async () => {
    const query = {} as QueryParamsDTO;
    const paginated: IResponsePaginatedService<Policy[]> = {
      data: [createMockPolicy()],
      pagination: {
        page: 1,
        page_size: 10,
        total: 1,
        total_records: 1,
        total_pages: 1,
      },
    };
    mockPoliciesService.findPaginated.mockResolvedValue(paginated);

    const result = await controller.findPaginated(query);

    expect(mockPoliciesService.findPaginated).toHaveBeenCalledWith(query);
    expect(result).toBe(paginated);
  });

  it('findOne() delegates to service.findById', async () => {
    const policy = createMockPolicy();
    mockPoliciesService.findById.mockResolvedValue(policy);

    const result = await controller.findOne(POLICY_ID);

    expect(mockPoliciesService.findById).toHaveBeenCalledWith(POLICY_ID);
    expect(result).toBe(policy);
  });

  it('update() delegates to service.update', async () => {
    const dto: UpdatePolicyDTO = { name_en: 'Updated' };
    const updated = createMockPolicy({ name_en: 'Updated' });
    mockPoliciesService.update.mockResolvedValue(updated);

    const result = await controller.update(POLICY_ID, dto, mockCurrentUser);

    expect(mockPoliciesService.update).toHaveBeenCalledWith(
      POLICY_ID,
      dto,
      mockCurrentUser,
      undefined,
    );
    expect(result).toBe(updated);
  });

  it('softDelete() delegates to service.delete with soft delete flag', async () => {
    mockPoliciesService.delete.mockResolvedValue(undefined);

    await controller.softDelete(POLICY_ID, mockCurrentUser);

    expect(mockPoliciesService.delete).toHaveBeenCalledWith(
      POLICY_ID,
      true,
      mockCurrentUser,
    );
  });

  it('getStatements() delegates to service.getStatements', async () => {
    const expanded: IExpandedStatement[] = [
      {
        id: 'statement-1',
        effect: 'allow',
        plane: 'api',
        targets: [],
        permissions: [],
        conditions: [],
      },
    ];
    mockPoliciesService.getStatements.mockResolvedValue(expanded);

    const result = await controller.getStatements(POLICY_ID);

    expect(mockPoliciesService.getStatements).toHaveBeenCalledWith(POLICY_ID);
    expect(result).toBe(expanded);
  });

  it('setStatements() delegates to service.setStatements with the current user id', async () => {
    const dto: SetStatementsDTO = {
      statements: [
        {
          effect: 'allow',
          plane: 'api',
          service: ['inventory-bc'],
          resource: ['goods_receipt'],
          permission_ids: ['perm-1'],
          conditions: [],
        },
      ],
    };
    mockPoliciesService.setStatements.mockResolvedValue(undefined);

    await controller.setStatements(POLICY_ID, dto, mockCurrentUser);

    expect(mockPoliciesService.setStatements).toHaveBeenCalledWith(
      POLICY_ID,
      dto.statements,
      mockCurrentUser.id,
    );
  });

  it('setStatements() falls back to undefined when currentUser.id is null', async () => {
    const dto: SetStatementsDTO = { statements: [] };
    const sessionWithoutId = createMockUserSession({ id: null });
    mockPoliciesService.setStatements.mockResolvedValue(undefined);

    await controller.setStatements(POLICY_ID, dto, sessionWithoutId);

    expect(mockPoliciesService.setStatements).toHaveBeenCalledWith(
      POLICY_ID,
      [],
      undefined,
    );
  });
});
