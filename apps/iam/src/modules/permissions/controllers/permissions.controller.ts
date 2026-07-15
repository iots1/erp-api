import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
  IResponsePaginatedService,
  RequirePermission,
  ParseUuidParamPipe,
} from '@lib/common';
import {
  ApiJsonApiCollectionResponse,
  ApiJsonApiResponse,
} from '@lib/common/decorators/json-api-response.decorator';
import { ResourceType } from '@lib/common/decorators/resource-type.decorator';
import { ValidatedQuery } from '@lib/common/decorators/validated-query.decorator';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';

import { PermissionResponseDTO } from '../dto/permission-response.dto';
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
  @ApiOperation({ summary: 'List permission catalog (for Policy Generator)' })
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
  @ApiOperation({ summary: 'Get permission by id' })
  @ApiParam({ name: 'id', description: 'Permission id' })
  @ApiJsonApiResponse('permissions', HttpStatus.OK, PermissionResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<Permission> {
    return this.permissionsService.findById(id);
  }
}
