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
  BRAND_ID_PARAM_DESCRIPTION,
  CREATE_BRAND_SUMMARY,
  DELETE_BRAND_SUMMARY,
  GET_BRAND_SUMMARY,
  GET_BRANDS_SUMMARY,
  UPDATE_BRAND_SUMMARY,
} from '../constants/brand.swagger';
import { BrandResponseDTO } from '../dto/brand-response.dto';
import { CreateBrandDTO } from '../dto/create-brand.dto';
import { UpdateBrandDTO } from '../dto/update-brand.dto';
import { Brand } from '../entities/brand.entity';
import { BrandsService } from '../services/brands.service';

@ResourceType('brands')
@ApiTags('Brands')
@Controller('brands')
export class BrandsController extends BaseControllerOperations<
  Brand,
  CreateBrandDTO,
  UpdateBrandDTO,
  BrandsService
> {
  constructor(brandsService: BrandsService) {
    super(brandsService);
  }

  @Post()
  @RequirePermission('brand:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_BRAND_SUMMARY })
  @ApiJsonApiCreatedResponse('brands', BrandResponseDTO)
  create(
    @Body() createDTO: CreateBrandDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Brand> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('brand:view')
  @ApiOperation({ summary: GET_BRANDS_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse('brands', HttpStatus.OK, BrandResponseDTO)
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<Brand[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('brand:view')
  @ApiOperation({ summary: GET_BRAND_SUMMARY })
  @ApiParam({ name: 'id', description: BRAND_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('brands', HttpStatus.OK, BrandResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<Brand> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('brand:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_BRAND_SUMMARY })
  @ApiParam({ name: 'id', description: BRAND_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('brands', HttpStatus.OK, BrandResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateBrandDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Brand> {
    return super.update(id, updateDTO, currentUser);
  }

  @Delete(':id')
  @RequirePermission('brand:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_BRAND_SUMMARY })
  @ApiParam({ name: 'id', description: BRAND_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
