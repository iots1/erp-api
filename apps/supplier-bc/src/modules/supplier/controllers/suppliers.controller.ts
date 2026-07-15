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
  CREATE_SUPPLIER_SUMMARY,
  DELETE_SUPPLIER_SUMMARY,
  GET_SUPPLIER_SUMMARY,
  GET_SUPPLIERS_SUMMARY,
  SUPPLIER_ID_PARAM_DESCRIPTION,
  UPDATE_SUPPLIER_SUMMARY,
} from '../constants/supplier.swagger';
import { CreateSupplierDTO } from '../dto/create-supplier.dto';
import { SupplierResponseDTO } from '../dto/supplier-response.dto';
import { UpdateSupplierDTO } from '../dto/update-supplier.dto';
import { Supplier } from '../entities/supplier.entity';
import { SuppliersService } from '../services/suppliers.service';

@ResourceType('suppliers')
@ApiTags('Suppliers')
@Controller('suppliers')
export class SuppliersController extends BaseControllerOperations<
  Supplier,
  CreateSupplierDTO,
  UpdateSupplierDTO,
  SuppliersService
> {
  constructor(suppliersService: SuppliersService) {
    super(suppliersService);
  }

  @Post()
  @RequirePermission('supplier:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_SUPPLIER_SUMMARY })
  @ApiJsonApiCreatedResponse('suppliers', SupplierResponseDTO)
  create(
    @Body() createDTO: CreateSupplierDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Supplier> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('supplier:view')
  @ApiOperation({ summary: GET_SUPPLIERS_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse('suppliers', HttpStatus.OK, SupplierResponseDTO)
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<Supplier[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('supplier:view')
  @ApiOperation({ summary: GET_SUPPLIER_SUMMARY })
  @ApiParam({ name: 'id', description: SUPPLIER_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('suppliers', HttpStatus.OK, SupplierResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<Supplier> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('supplier:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_SUPPLIER_SUMMARY })
  @ApiParam({ name: 'id', description: SUPPLIER_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('suppliers', HttpStatus.OK, SupplierResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateSupplierDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Supplier> {
    return super.update(id, updateDTO, currentUser);
  }

  @Delete(':id')
  @RequirePermission('supplier:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_SUPPLIER_SUMMARY })
  @ApiParam({ name: 'id', description: SUPPLIER_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
