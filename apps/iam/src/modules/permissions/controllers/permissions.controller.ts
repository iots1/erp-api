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

import {
  CREATE_PERMISSION_SUMMARY,
  DELETE_PERMISSION_SUMMARY,
  GET_PERMISSION_SUMMARY,
  GET_PERMISSIONS_SUMMARY,
  PERMISSION_ID_PARAM_DESCRIPTION,
  UPDATE_PERMISSION_SUMMARY,
} from '../constants/permissions.swagger';
import { CreatePermissionDTO } from '../dto/create-permission.dto';
import { PermissionResponseDTO } from '../dto/permission-response.dto';
import { UpdatePermissionDTO } from '../dto/update-permission.dto';
import { Permission } from '../entities/permission.entity';
import { PermissionsService } from '../services/permissions.service';

@ResourceType('permissions')
@ApiTags('Permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermission('permission:read', {
    th: 'ดูแคตตาล็อกสิทธิ์',
    en: 'View permission catalog',
  })
  @ApiOperation({ summary: GET_PERMISSIONS_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'permissions',
    HttpStatus.OK,
    PermissionResponseDTO,
  )
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<Permission[]>> {
    return this.permissionsService.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('permission:read', {
    th: 'ดูแคตตาล็อกสิทธิ์',
    en: 'View permission catalog',
  })
  @ApiOperation({ summary: GET_PERMISSION_SUMMARY })
  @ApiParam({ name: 'id', description: PERMISSION_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('permissions', HttpStatus.OK, PermissionResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<Permission> {
    return this.permissionsService.findById(id);
  }

  @Post()
  @RequirePermission('permission:create', {
    th: 'เพิ่มสิทธิ์ด้วยตนเอง',
    en: 'Manually add permissions',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_PERMISSION_SUMMARY })
  @ApiJsonApiCreatedResponse('permissions', PermissionResponseDTO)
  create(
    @Body() createDTO: CreatePermissionDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Permission> {
    return this.permissionsService.createManual(createDTO, currentUser);
  }

  @Put(':id')
  @RequirePermission('permission:update', {
    th: 'แก้ไขสิทธิ์',
    en: 'Update permissions',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_PERMISSION_SUMMARY })
  @ApiParam({ name: 'id', description: PERMISSION_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('permissions', HttpStatus.OK, PermissionResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdatePermissionDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Permission> {
    return this.permissionsService.updateManual(id, updateDTO, currentUser);
  }

  @Delete(':id')
  @RequirePermission('permission:delete', {
    th: 'ลบสิทธิ์',
    en: 'Delete permissions',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_PERMISSION_SUMMARY })
  @ApiParam({ name: 'id', description: PERMISSION_ID_PARAM_DESCRIPTION })
  async remove(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    await this.permissionsService.removeManual(id, currentUser);
  }
}
