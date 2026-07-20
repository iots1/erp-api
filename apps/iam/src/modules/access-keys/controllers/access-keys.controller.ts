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
  ParseUuidParamPipe,
  RequirePermission,
  type IUserSession,
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
  ACCESS_KEY_ID_PARAM_DESCRIPTION,
  ATTACH_POLICIES_SUMMARY,
  CREATE_ACCESS_KEY_SUMMARY,
  DELETE_ACCESS_KEY_SUMMARY,
  GET_ACCESS_KEY_POLICIES_SUMMARY,
  GET_ACCESS_KEY_SUMMARY,
  GET_ACCESS_KEYS_SUMMARY,
  REVOKE_ACCESS_KEY_SUMMARY,
  UPDATE_ACCESS_KEY_SUMMARY,
} from '../constants/access-keys.swagger';
import { AttachAccessKeyPolicyDTO } from '../dto/attach-access-key-policy.dto';
import { AccessKeyResponseDTO } from '../dto/access-key-response.dto';
import {
  CreateAccessKeyDTO,
  CreateAccessKeyResponseDTO,
} from '../dto/create-access-key.dto';
import { UpdateAccessKeyDTO } from '../dto/update-access-key.dto';
import { AccessKey } from '../entities/access-key.entity';
import { AccessKeysService } from '../services/access-keys.service';

@ResourceType('access-keys')
@ApiTags('Access Keys')
@Controller('access-keys')
export class AccessKeysController extends BaseControllerOperations<
  AccessKey,
  CreateAccessKeyDTO,
  UpdateAccessKeyDTO,
  AccessKeysService
> {
  constructor(accessKeysService: AccessKeysService) {
    super(accessKeysService);
  }

  @Post()
  @RequirePermission('access_key:create', {
    th: 'สร้าง Access Key',
    en: 'Create access keys',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_ACCESS_KEY_SUMMARY })
  @ApiJsonApiCreatedResponse('access-keys', CreateAccessKeyResponseDTO)
  issue(
    @Body() createDTO: CreateAccessKeyDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<CreateAccessKeyResponseDTO> {
    return this.service.issue(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('access_key:read', {
    th: 'ดู Access Key',
    en: 'View access keys',
  })
  @ApiOperation({ summary: GET_ACCESS_KEYS_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'access-keys',
    HttpStatus.OK,
    AccessKeyResponseDTO,
  )
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<AccessKey[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('access_key:read', {
    th: 'ดู Access Key',
    en: 'View access keys',
  })
  @ApiOperation({ summary: GET_ACCESS_KEY_SUMMARY })
  @ApiParam({ name: 'id', description: ACCESS_KEY_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('access-keys', HttpStatus.OK, AccessKeyResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<AccessKey> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('access_key:update', {
    th: 'แก้ไข Access Key',
    en: 'Update access keys',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_ACCESS_KEY_SUMMARY })
  @ApiParam({ name: 'id', description: ACCESS_KEY_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('access-keys', HttpStatus.OK, AccessKeyResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateAccessKeyDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<AccessKey> {
    return super.update(id, updateDTO, currentUser);
  }

  @Get(':id/policies')
  @RequirePermission('access_key:read', {
    th: 'ดู Access Key',
    en: 'View access keys',
  })
  @ApiOperation({ summary: GET_ACCESS_KEY_POLICIES_SUMMARY })
  @ApiParam({ name: 'id', description: ACCESS_KEY_ID_PARAM_DESCRIPTION })
  async findPolicies(
    @Param('id', ParseUuidParamPipe) id: string,
  ): Promise<{ id: string; policy_ids: string[] }> {
    const policy_ids = await this.service.findPolicyIds(id);
    return { id, policy_ids };
  }

  @Put(':id/policies')
  @RequirePermission('access_key:update', {
    th: 'แก้ไข Access Key',
    en: 'Update access keys',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: ATTACH_POLICIES_SUMMARY })
  @ApiParam({ name: 'id', description: ACCESS_KEY_ID_PARAM_DESCRIPTION })
  async attachPolicies(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() dto: AttachAccessKeyPolicyDTO,
  ): Promise<void> {
    await this.service.attachPolicies(id, dto.policy_ids);
  }

  @Delete(':id/revoke')
  @RequirePermission('access_key:revoke', {
    th: 'เพิกถอน Access Key',
    en: 'Revoke access keys',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: REVOKE_ACCESS_KEY_SUMMARY })
  @ApiParam({ name: 'id', description: ACCESS_KEY_ID_PARAM_DESCRIPTION })
  async revoke(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    await this.service.revoke(id, currentUser);
  }

  @Delete(':id')
  @RequirePermission('access_key:delete', {
    th: 'ลบ Access Key',
    en: 'Delete access keys',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_ACCESS_KEY_SUMMARY })
  @ApiParam({ name: 'id', description: ACCESS_KEY_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
