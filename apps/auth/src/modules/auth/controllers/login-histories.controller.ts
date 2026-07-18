import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { IResponsePaginatedService, RequirePermission } from '@lib/common';
import { ApiJsonApiCollectionResponse } from '@lib/common/decorators/json-api-response.decorator';
import { ResourceType } from '@lib/common/decorators/resource-type.decorator';
import { ValidatedQuery } from '@lib/common/decorators/validated-query.decorator';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import { BaseControllerOperations } from '@lib/common/utils/base-operations/base-controller-operations.util';

import { GET_LOGIN_HISTORIES_SUMMARY } from '../constants/login-histories.swagger';
import { LoginHistoryResponseDTO } from '../dto/login-history-response.dto';
import { LoginHistory } from '../entities/login-history.entity';
import { LoginHistoriesService } from '../services/login-histories.service';

/**
 * Read-only audit log of login attempts — backs the iam-view "audit-logs" page.
 * Supports the standard `filter[]=field||$op||value` / `search` query syntax
 * (e.g. `filter[]=username||$cont||somchai`, `filter[]=is_success||$eq||false`).
 */
@ResourceType('login-histories')
@ApiTags('Login Histories')
@Controller('auth/login-histories')
export class LoginHistoriesController extends BaseControllerOperations<
  LoginHistory,
  Partial<LoginHistory>,
  Partial<LoginHistory>,
  LoginHistoriesService
> {
  constructor(loginHistoriesService: LoginHistoriesService) {
    super(loginHistoriesService);
  }

  @Get()
  @RequirePermission('login_history:read', {
    th: 'ดูประวัติการเข้าใช้งาน',
    en: 'View login histories',
  })
  @ApiOperation({ summary: GET_LOGIN_HISTORIES_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'login-histories',
    HttpStatus.OK,
    LoginHistoryResponseDTO,
  )
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<LoginHistory[]>> {
    return super.findPaginated(query);
  }
}
