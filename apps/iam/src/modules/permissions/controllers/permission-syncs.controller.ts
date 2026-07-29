import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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

import {
  CREATE_PERMISSION_SYNC_SUMMARY,
  GET_PERMISSION_SYNC_SUMMARY,
  GET_PERMISSION_SYNCS_SUMMARY,
  PERMISSION_SYNC_ID_PARAM_DESCRIPTION,
} from '../constants/permission-syncs.swagger';
import { PermissionSyncLogResponseDTO } from '../dto/permission-sync-log-response.dto';
import { PermissionSyncLog } from '../entities/permission-sync-log.entity';
import { PermissionSyncLogsService } from '../services/permission-sync-logs.service';
import { PermissionsSyncService } from '../services/permissions-sync.service';

/**
 * `permission-syncs` — a "sync run" is a first-class resource here (a
 * `permission_sync_logs` row): `POST /permission-syncs` *creates* one by
 * running `permissions:sync` in-process, `GET /permission-syncs`
 * lists history. Kept as its own resource (rather than a
 * `POST /permissions/sync` action route under `PermissionsController`) to
 * follow REST convention — no verb in the URI, `POST` on the collection is
 * the create.
 */
@ResourceType('permission-syncs')
@ApiTags('Permission Syncs')
@Controller('permission-syncs')
export class PermissionSyncsController {
  constructor(
    private readonly permissionSyncLogsService: PermissionSyncLogsService,
    private readonly permissionsSyncService: PermissionsSyncService,
  ) {}

  @Get()
  @RequirePermission('permission_sync:read', {
    th: 'ดูประวัติการซิงค์สิทธิ์',
    en: 'View permission sync history',
  })
  @ApiOperation({ summary: GET_PERMISSION_SYNCS_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'permission-syncs',
    HttpStatus.OK,
    PermissionSyncLogResponseDTO,
  )
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<PermissionSyncLog[]>> {
    return this.permissionSyncLogsService.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('permission_sync:read', {
    th: 'ดูประวัติการซิงค์สิทธิ์',
    en: 'View permission sync history',
  })
  @ApiOperation({ summary: GET_PERMISSION_SYNC_SUMMARY })
  @ApiParam({
    name: 'id',
    description: PERMISSION_SYNC_ID_PARAM_DESCRIPTION,
  })
  @ApiJsonApiResponse(
    'permission-syncs',
    HttpStatus.OK,
    PermissionSyncLogResponseDTO,
  )
  findOne(
    @Param('id', ParseUuidParamPipe) id: string,
  ): Promise<PermissionSyncLog> {
    return this.permissionSyncLogsService.findById(id);
  }

  @Post()
  @RequirePermission('permission_sync:create', {
    th: 'สร้างการซิงค์สิทธิ์ใหม่',
    en: 'Trigger a new permission sync run',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_PERMISSION_SYNC_SUMMARY })
  @ApiJsonApiCreatedResponse('permission-syncs', PermissionSyncLogResponseDTO)
  create(
    @CurrentUser() currentUser: IUserSession,
  ): Promise<PermissionSyncLog> {
    const triggeredBy =
      currentUser.username ?? currentUser.email ?? 'iam-admin-web';
    return this.permissionsSyncService.runSync(triggeredBy);
  }
}
