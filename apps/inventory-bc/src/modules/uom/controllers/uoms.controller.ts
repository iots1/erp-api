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
  CREATE_UOM_SUMMARY,
  DELETE_UOM_SUMMARY,
  GET_UOM_SUMMARY,
  GET_UOMS_SUMMARY,
  UOM_ID_PARAM_DESCRIPTION,
  UPDATE_UOM_SUMMARY,
} from '../constants/uom.swagger';
import { CreateUomDTO } from '../dto/create-uom.dto';
import { UomResponseDTO } from '../dto/uom-response.dto';
import { UpdateUomDTO } from '../dto/update-uom.dto';
import { Uom } from '../entities/uom.entity';
import { UomsService } from '../services/uoms.service';

@ResourceType('uoms')
@ApiTags('UOMs')
@Controller('uoms')
export class UomsController extends BaseControllerOperations<
  Uom,
  CreateUomDTO,
  UpdateUomDTO,
  UomsService
> {
  constructor(uomsService: UomsService) {
    super(uomsService);
  }

  @Post()
  @RequirePermission('uom:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_UOM_SUMMARY })
  @ApiJsonApiCreatedResponse('uoms', UomResponseDTO)
  create(
    @Body() createDTO: CreateUomDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Uom> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('uom:view')
  @ApiOperation({ summary: GET_UOMS_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse('uoms', HttpStatus.OK, UomResponseDTO)
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<Uom[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('uom:view')
  @ApiOperation({ summary: GET_UOM_SUMMARY })
  @ApiParam({ name: 'id', description: UOM_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('uoms', HttpStatus.OK, UomResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<Uom> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('uom:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_UOM_SUMMARY })
  @ApiParam({ name: 'id', description: UOM_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('uoms', HttpStatus.OK, UomResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateUomDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Uom> {
    return super.update(id, updateDTO, currentUser);
  }

  @Delete(':id')
  @RequirePermission('uom:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_UOM_SUMMARY })
  @ApiParam({ name: 'id', description: UOM_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
