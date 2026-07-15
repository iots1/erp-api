import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
  CurrentUser,
  IResponsePaginatedService,
  RequirePermission,
  type IUserSession,
  ParseUuidParamPipe,
} from '@lib/common';
import {
  ApiJsonApiCollectionResponse,
  ApiJsonApiCreatedResponse,
  ApiJsonApiResponse,
} from '@lib/common/decorators/json-api-response.decorator';
import { ResourceType } from '@lib/common/decorators/resource-type.decorator';
import { ValidatedQuery } from '@lib/common/decorators/validated-query.decorator';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import { BaseControllerOperations } from '@lib/common/utils/base-operations/base-controller-operations.util';

import {
  ASSIGN_ROLES_SUMMARY,
  CREATE_USER_SUMMARY,
  DELETE_USER_SUMMARY,
  GET_USER_SUMMARY,
  GET_USERS_SUMMARY,
  UPDATE_USER_SUMMARY,
  USER_ID_PARAM_DESCRIPTION,
} from '../constants/users.swagger';
import { AssignRoleDTO } from '../dto/assign-role.dto';
import { CreateUserDTO } from '../dto/create-user.dto';
import { UpdateUserDTO } from '../dto/update-user.dto';
import { UserResponseDTO } from '../dto/user-response.dto';
import { User } from '../entities/user.entity';
import { UsersService } from '../services/users.service';

@ResourceType('users')
@ApiTags('Users')
@Controller('users')
export class UsersController extends BaseControllerOperations<
  User,
  CreateUserDTO,
  UpdateUserDTO,
  UsersService
> {
  constructor(usersService: UsersService) {
    super(usersService);
  }

  @Post()
  @RequirePermission('user_account:create', {
    th: 'สร้างบัญชีผู้ใช้',
    en: 'Create user accounts',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_USER_SUMMARY })
  @ApiJsonApiCreatedResponse('users', UserResponseDTO)
  create(
    @Body() createDTO: CreateUserDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<User> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('user_account:read', {
    th: 'ดูบัญชีผู้ใช้',
    en: 'View user accounts',
  })
  @ApiOperation({ summary: GET_USERS_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse('users', HttpStatus.OK, UserResponseDTO)
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<User[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('user_account:read', {
    th: 'ดูบัญชีผู้ใช้',
    en: 'View user accounts',
  })
  @ApiOperation({ summary: GET_USER_SUMMARY })
  @ApiParam({ name: 'id', description: USER_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('users', HttpStatus.OK, UserResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<User> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('user_account:create', {
    th: 'สร้างบัญชีผู้ใช้',
    en: 'Create user accounts',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_USER_SUMMARY })
  @ApiParam({ name: 'id', description: USER_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('users', HttpStatus.OK, UserResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateUserDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<User> {
    return super.update(id, updateDTO, currentUser);
  }

  @Put(':id/roles')
  @RequirePermission('user_account:assign_role', {
    th: 'กำหนดบทบาทผู้ใช้',
    en: 'Assign roles to users',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: ASSIGN_ROLES_SUMMARY })
  @ApiParam({ name: 'id', description: USER_ID_PARAM_DESCRIPTION })
  async assignRoles(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() dto: AssignRoleDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    await this.service.assignRoles(
      id,
      dto.role_ids,
      currentUser.id ?? undefined,
    );
  }

  @Delete(':id')
  @RequirePermission('user_account:create', {
    th: 'สร้างบัญชีผู้ใช้',
    en: 'Create user accounts',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_USER_SUMMARY })
  @ApiParam({ name: 'id', description: USER_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
