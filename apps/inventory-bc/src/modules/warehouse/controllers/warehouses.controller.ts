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
  CREATE_WAREHOUSE_SUMMARY,
  DELETE_WAREHOUSE_SUMMARY,
  GET_WAREHOUSE_SUMMARY,
  GET_WAREHOUSES_SUMMARY,
  UPDATE_WAREHOUSE_SUMMARY,
  WAREHOUSE_ID_PARAM_DESCRIPTION,
} from '../constants/warehouse.swagger';
import { CreateWarehouseDTO } from '../dto/create-warehouse.dto';
import { UpdateWarehouseDTO } from '../dto/update-warehouse.dto';
import { WarehouseResponseDTO } from '../dto/warehouse-response.dto';
import { Warehouse } from '../entities/warehouse.entity';
import { WarehousesService } from '../services/warehouses.service';

@ResourceType('warehouses')
@ApiTags('Warehouses')
@Controller('warehouses')
export class WarehousesController extends BaseControllerOperations<
  Warehouse,
  CreateWarehouseDTO,
  UpdateWarehouseDTO,
  WarehousesService
> {
  constructor(warehousesService: WarehousesService) {
    super(warehousesService);
  }

  @Post()
  @RequirePermission('warehouse:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_WAREHOUSE_SUMMARY })
  @ApiJsonApiCreatedResponse('warehouses', WarehouseResponseDTO)
  create(
    @Body() createDTO: CreateWarehouseDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Warehouse> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('warehouse:view')
  @ApiOperation({ summary: GET_WAREHOUSES_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'warehouses',
    HttpStatus.OK,
    WarehouseResponseDTO,
  )
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<Warehouse[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('warehouse:view')
  @ApiOperation({ summary: GET_WAREHOUSE_SUMMARY })
  @ApiParam({ name: 'id', description: WAREHOUSE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('warehouses', HttpStatus.OK, WarehouseResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<Warehouse> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('warehouse:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_WAREHOUSE_SUMMARY })
  @ApiParam({ name: 'id', description: WAREHOUSE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('warehouses', HttpStatus.OK, WarehouseResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateWarehouseDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Warehouse> {
    return super.update(id, updateDTO, currentUser);
  }

  @Delete(':id')
  @RequirePermission('warehouse:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_WAREHOUSE_SUMMARY })
  @ApiParam({ name: 'id', description: WAREHOUSE_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
