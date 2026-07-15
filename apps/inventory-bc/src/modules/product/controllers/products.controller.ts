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
  CREATE_PRODUCT_SUMMARY,
  DELETE_PRODUCT_SUMMARY,
  GENERATE_VARIANTS_SUMMARY,
  GET_PRODUCT_SUMMARY,
  GET_PRODUCTS_SUMMARY,
  PRODUCT_ID_PARAM_DESCRIPTION,
  UPDATE_PRODUCT_SUMMARY,
} from '../constants/product.swagger';
import { CreateProductDTO } from '../dto/create-product.dto';
import { GenerateVariantsDTO } from '../dto/generate-variants.dto';
import { ProductResponseDTO } from '../dto/product-response.dto';
import { UpdateProductDTO } from '../dto/update-product.dto';
import { Product } from '../entities/product.entity';
import { ProductsService } from '../services/products.service';

@ResourceType('products')
@ApiTags('Products')
@Controller('products')
export class ProductsController extends BaseControllerOperations<
  Product,
  CreateProductDTO,
  UpdateProductDTO,
  ProductsService
> {
  constructor(productsService: ProductsService) {
    super(productsService);
  }

  @Post()
  @RequirePermission('product:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_PRODUCT_SUMMARY })
  @ApiJsonApiCreatedResponse('products', ProductResponseDTO)
  create(
    @Body() createDTO: CreateProductDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Product> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('product:view')
  @ApiOperation({ summary: GET_PRODUCTS_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse('products', HttpStatus.OK, ProductResponseDTO)
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<Product[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('product:view')
  @ApiOperation({ summary: GET_PRODUCT_SUMMARY })
  @ApiParam({ name: 'id', description: PRODUCT_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('products', HttpStatus.OK, ProductResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<Product> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('product:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_PRODUCT_SUMMARY })
  @ApiParam({ name: 'id', description: PRODUCT_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('products', HttpStatus.OK, ProductResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateProductDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Product> {
    return super.update(id, updateDTO, currentUser);
  }

  @Delete(':id')
  @RequirePermission('product:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_PRODUCT_SUMMARY })
  @ApiParam({ name: 'id', description: PRODUCT_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }

  @Post(':id/generate-variants')
  @RequirePermission('product:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: GENERATE_VARIANTS_SUMMARY })
  @ApiParam({
    name: 'id',
    description: 'Template product ID (has_variants=true)',
  })
  @ApiJsonApiCollectionResponse(
    'products',
    HttpStatus.CREATED,
    ProductResponseDTO,
  )
  generateVariants(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() dto: GenerateVariantsDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<Product[]> {
    return this.service.generateVariants(id, dto, currentUser);
  }
}
