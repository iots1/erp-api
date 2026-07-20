import { Test, TestingModule } from '@nestjs/testing';

import type { IUserSession } from '@lib/common';

import { UsersController } from '@apps/iam/src/modules/users/controllers/users.controller';
import { UsersService } from '@apps/iam/src/modules/users/services/users.service';
import { CreateUserDTO } from '@apps/iam/src/modules/users/dto/create-user.dto';
import { UpdateUserDTO } from '@apps/iam/src/modules/users/dto/update-user.dto';
import { AssignRoleDTO } from '@apps/iam/src/modules/users/dto/assign-role.dto';
import { User } from '@apps/iam/src/modules/users/entities/user.entity';
import type { IResponsePaginatedService } from '@lib/common';
import type { QueryParamsDTO } from '@lib/common/dto/query-params.dto';

import { createMockUser } from '../../mocks/mock-user';
import { createMockUserSession } from '../../mocks/mock-user-session';

type MockUsersService = {
  create: jest.Mock<Promise<User>, [CreateUserDTO, IUserSession]>;
  findPaginated: jest.Mock<
    Promise<IResponsePaginatedService<User[]>>,
    [QueryParamsDTO]
  >;
  findById: jest.Mock<Promise<User>, [string]>;
  update: jest.Mock<Promise<User>, [string, UpdateUserDTO, IUserSession]>;
  delete: jest.Mock<Promise<void>, [string, boolean, IUserSession]>;
  findRoleIds: jest.Mock<Promise<string[]>, [string]>;
  assignRoles: jest.Mock<Promise<void>, [string, string[], string | undefined]>;
};

function createMockUsersService(): MockUsersService {
  return {
    create: jest.fn<Promise<User>, [CreateUserDTO, IUserSession]>(),
    findPaginated: jest.fn<
      Promise<IResponsePaginatedService<User[]>>,
      [QueryParamsDTO]
    >(),
    findById: jest.fn<Promise<User>, [string]>(),
    update: jest.fn<Promise<User>, [string, UpdateUserDTO, IUserSession]>(),
    delete: jest.fn<Promise<void>, [string, boolean, IUserSession]>(),
    findRoleIds: jest.fn<Promise<string[]>, [string]>(),
    assignRoles: jest.fn<
      Promise<void>,
      [string, string[], string | undefined]
    >(),
  };
}

const USER_ID = 'a0a0a0a0-0000-4000-8000-000000000009';
const ROLE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROLE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('UsersController (Unit)', () => {
  let controller: UsersController;
  const mockUsersService = createMockUsersService();
  const mockCurrentUser: IUserSession = createMockUserSession();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() delegates to service.create', async () => {
    const dto: CreateUserDTO = {
      username: 'jane.doe',
      employee_id: 'EMP-1',
      full_name: 'Jane Doe',
      email: 'jane@erp.local',
      department: null,
      status: 'pending',
    };
    const created = createMockUser();
    mockUsersService.create.mockResolvedValue(created);

    const result = await controller.create(dto, mockCurrentUser);

    expect(mockUsersService.create).toHaveBeenCalledWith(dto, mockCurrentUser);
    expect(result).toBe(created);
  });

  it('findPaginated() delegates to service.findPaginated', async () => {
    const query = {} as QueryParamsDTO;
    const paginated: IResponsePaginatedService<User[]> = {
      data: [createMockUser()],
      pagination: {
        page: 1,
        page_size: 10,
        total: 1,
        total_records: 1,
        total_pages: 1,
      },
    };
    mockUsersService.findPaginated.mockResolvedValue(paginated);

    const result = await controller.findPaginated(query);

    expect(mockUsersService.findPaginated).toHaveBeenCalledWith(query);
    expect(result).toBe(paginated);
  });

  it('findOne() delegates to service.findById', async () => {
    const user = createMockUser();
    mockUsersService.findById.mockResolvedValue(user);

    const result = await controller.findOne(USER_ID);

    expect(mockUsersService.findById).toHaveBeenCalledWith(USER_ID);
    expect(result).toBe(user);
  });

  it('update() delegates to service.update', async () => {
    const dto: UpdateUserDTO = { full_name: 'Jane Updated' };
    const updated = createMockUser({ full_name: 'Jane Updated' });
    mockUsersService.update.mockResolvedValue(updated);

    const result = await controller.update(USER_ID, dto, mockCurrentUser);

    expect(mockUsersService.update).toHaveBeenCalledWith(
      USER_ID,
      dto,
      mockCurrentUser,
      undefined,
    );
    expect(result).toBe(updated);
  });

  it('softDelete() delegates to service.delete with soft delete flag', async () => {
    mockUsersService.delete.mockResolvedValue(undefined);

    await controller.softDelete(USER_ID, mockCurrentUser);

    expect(mockUsersService.delete).toHaveBeenCalledWith(
      USER_ID,
      true,
      mockCurrentUser,
    );
  });

  it('findRoles() delegates to service.findRoleIds and wraps the response', async () => {
    mockUsersService.findRoleIds.mockResolvedValue([ROLE_A, ROLE_B]);

    const result = await controller.findRoles(USER_ID);

    expect(mockUsersService.findRoleIds).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual({ id: USER_ID, role_ids: [ROLE_A, ROLE_B] });
  });

  it('assignRoles() delegates to service.assignRoles with the current user id', async () => {
    const dto: AssignRoleDTO = { role_ids: [ROLE_A, ROLE_B] };
    mockUsersService.assignRoles.mockResolvedValue(undefined);

    await controller.assignRoles(USER_ID, dto, mockCurrentUser);

    expect(mockUsersService.assignRoles).toHaveBeenCalledWith(
      USER_ID,
      [ROLE_A, ROLE_B],
      mockCurrentUser.id,
    );
  });

  it('assignRoles() falls back to undefined when currentUser.id is null', async () => {
    const dto: AssignRoleDTO = { role_ids: [ROLE_A] };
    const sessionWithoutId = createMockUserSession({ id: null });
    mockUsersService.assignRoles.mockResolvedValue(undefined);

    await controller.assignRoles(USER_ID, dto, sessionWithoutId);

    expect(mockUsersService.assignRoles).toHaveBeenCalledWith(
      USER_ID,
      [ROLE_A],
      undefined,
    );
  });
});
