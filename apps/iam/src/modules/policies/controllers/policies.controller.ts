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
  CREATE_POLICY_SUMMARY,
  DELETE_POLICY_SUMMARY,
  GET_POLICIES_SUMMARY,
  GET_POLICY_STATEMENTS_SUMMARY,
  GET_POLICY_SUMMARY,
  POLICY_ID_PARAM_DESCRIPTION,
  SET_POLICY_STATEMENTS_SUMMARY,
  UPDATE_POLICY_SUMMARY,
} from '../constants/policies.swagger';
import { CreatePolicyDTO } from '../dto/create-policy.dto';
import { PolicyResponseDTO } from '../dto/policy-response.dto';
import { SetStatementsDTO } from '../dto/set-statements.dto';
import { UpdatePolicyDTO } from '../dto/update-policy.dto';
import { Policy } from '../entities/policy.entity';
import {
  IExpandedStatement,
  PoliciesService,
} from '../services/policies.service';

@ResourceType('policies')
@ApiTags('Policies')
@Controller('policies')
export class PoliciesController extends BaseControllerOperations<
  Policy,
  CreatePolicyDTO,
  UpdatePolicyDTO,
  PoliciesService
> {
  constructor(policiesService: PoliciesService) {
    super(policiesService);
  }

  @Post()
  @RequirePermission('policy:create', {
    th: 'สร้างนโยบาย',
    en: 'Create policies',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_POLICY_SUMMARY })
  @ApiJsonApiCreatedResponse('policies', PolicyResponseDTO)
  create(
    @Body() createDTO: CreatePolicyDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Policy> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('policy:read', { th: 'ดูนโยบาย', en: 'View policies' })
  @ApiOperation({ summary: GET_POLICIES_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse('policies', HttpStatus.OK, PolicyResponseDTO)
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<Policy[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('policy:read', { th: 'ดูนโยบาย', en: 'View policies' })
  @ApiOperation({ summary: GET_POLICY_SUMMARY })
  @ApiParam({ name: 'id', description: POLICY_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('policies', HttpStatus.OK, PolicyResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<Policy> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('policy:create', {
    th: 'สร้างนโยบาย',
    en: 'Create policies',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_POLICY_SUMMARY })
  @ApiParam({ name: 'id', description: POLICY_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('policies', HttpStatus.OK, PolicyResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdatePolicyDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Policy> {
    return super.update(id, updateDTO, currentUser);
  }

  @Get(':id/statements')
  @RequirePermission('policy:read', { th: 'ดูนโยบาย', en: 'View policies' })
  @ApiOperation({ summary: GET_POLICY_STATEMENTS_SUMMARY })
  @ApiParam({ name: 'id', description: POLICY_ID_PARAM_DESCRIPTION })
  getStatements(
    @Param('id', ParseUuidParamPipe) id: string,
  ): Promise<IExpandedStatement[]> {
    return this.service.getStatements(id);
  }

  @Put(':id/statements')
  @RequirePermission('policy:create', {
    th: 'สร้างนโยบาย',
    en: 'Create policies',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: SET_POLICY_STATEMENTS_SUMMARY })
  @ApiParam({ name: 'id', description: POLICY_ID_PARAM_DESCRIPTION })
  async setStatements(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() dto: SetStatementsDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    await this.service.setStatements(
      id,
      dto.statements,
      currentUser.id ?? undefined,
    );
  }

  @Delete(':id')
  @RequirePermission('policy:create', {
    th: 'สร้างนโยบาย',
    en: 'Create policies',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_POLICY_SUMMARY })
  @ApiParam({ name: 'id', description: POLICY_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
