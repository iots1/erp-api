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
  ATTACH_POLICIES_SUMMARY,
  CREATE_ROLE_SUMMARY,
  DELETE_ROLE_SUMMARY,
  GET_ROLE_POLICIES_SUMMARY,
  GET_ROLE_SUMMARY,
  GET_ROLES_SUMMARY,
  ROLE_ID_PARAM_DESCRIPTION,
  UPDATE_ROLE_SUMMARY,
} from '../constants/roles.swagger';
import { AttachPolicyDTO } from '../dto/attach-policy.dto';
import { CreateRoleDTO } from '../dto/create-role.dto';
import { RoleResponseDTO } from '../dto/role-response.dto';
import { UpdateRoleDTO } from '../dto/update-role.dto';
import { Role } from '../entities/role.entity';
import { RolesService } from '../services/roles.service';

@ResourceType('roles')
@ApiTags('Roles')
@Controller('roles')
export class RolesController extends BaseControllerOperations<
  Role,
  CreateRoleDTO,
  UpdateRoleDTO,
  RolesService
> {
  constructor(rolesService: RolesService) {
    super(rolesService);
  }

  @Post()
  @RequirePermission('role:create', { th: 'สร้างบทบาท', en: 'Create roles' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_ROLE_SUMMARY })
  @ApiJsonApiCreatedResponse('roles', RoleResponseDTO)
  create(
    @Body() createDTO: CreateRoleDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Role> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('role:read', { th: 'ดูบทบาท', en: 'View roles' })
  @ApiOperation({ summary: GET_ROLES_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse('roles', HttpStatus.OK, RoleResponseDTO)
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<Role[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('role:read', { th: 'ดูบทบาท', en: 'View roles' })
  @ApiOperation({ summary: GET_ROLE_SUMMARY })
  @ApiParam({ name: 'id', description: ROLE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('roles', HttpStatus.OK, RoleResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<Role> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('role:update', { th: 'แก้ไขบทบาท', en: 'Update roles' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_ROLE_SUMMARY })
  @ApiParam({ name: 'id', description: ROLE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('roles', HttpStatus.OK, RoleResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateRoleDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Role> {
    return super.update(id, updateDTO, currentUser);
  }

  @Get(':id/policies')
  @RequirePermission('role:read', { th: 'ดูบทบาท', en: 'View roles' })
  @ApiOperation({ summary: GET_ROLE_POLICIES_SUMMARY })
  @ApiParam({ name: 'id', description: ROLE_ID_PARAM_DESCRIPTION })
  async findPolicies(
    @Param('id', ParseUuidParamPipe) id: string,
  ): Promise<{ id: string; policy_ids: string[] }> {
    const policy_ids = await this.service.findPolicyIds(id);
    return { id, policy_ids };
  }

  @Put(':id/policies')
  @RequirePermission('role:update', { th: 'แก้ไขบทบาท', en: 'Update roles' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: ATTACH_POLICIES_SUMMARY })
  @ApiParam({ name: 'id', description: ROLE_ID_PARAM_DESCRIPTION })
  async attachPolicies(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() dto: AttachPolicyDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    await this.service.attachPolicies(
      id,
      dto.policy_ids,
      currentUser.id ?? undefined,
    );
  }

  @Delete(':id')
  @RequirePermission('role:update', { th: 'แก้ไขบทบาท', en: 'Update roles' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_ROLE_SUMMARY })
  @ApiParam({ name: 'id', description: ROLE_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
