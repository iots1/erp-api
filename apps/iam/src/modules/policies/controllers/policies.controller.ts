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
  @ApiOperation({ summary: 'Create policy' })
  @ApiJsonApiCreatedResponse('policies', PolicyResponseDTO)
  create(
    @Body() createDTO: CreatePolicyDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Policy> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('policy:read', { th: 'ดูนโยบาย', en: 'View policies' })
  @ApiOperation({ summary: 'List policies' })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse('policies', HttpStatus.OK, PolicyResponseDTO)
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<Policy[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('policy:read', { th: 'ดูนโยบาย', en: 'View policies' })
  @ApiOperation({ summary: 'Get policy by id' })
  @ApiParam({ name: 'id', description: 'Policy id' })
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
  @ApiOperation({ summary: 'Update policy metadata' })
  @ApiParam({ name: 'id', description: 'Policy id' })
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
  @ApiOperation({
    summary: 'Get expanded statement tree (Policy Generator output)',
  })
  @ApiParam({ name: 'id', description: 'Policy id' })
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
  @ApiOperation({
    summary: 'Replace policy statements (compiled from Policy Generator)',
  })
  @ApiParam({ name: 'id', description: 'Policy id' })
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
  @ApiOperation({ summary: 'Soft delete policy' })
  @ApiParam({ name: 'id', description: 'Policy id' })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
