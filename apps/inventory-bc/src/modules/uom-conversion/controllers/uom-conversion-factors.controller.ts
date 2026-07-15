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

import {
  CREATE_UOM_CONVERSION_FACTOR_SUMMARY,
  DELETE_UOM_CONVERSION_FACTOR_SUMMARY,
  GET_UOM_CONVERSION_FACTOR_SUMMARY,
  GET_UOM_CONVERSION_FACTORS_SUMMARY,
  UOM_CONVERSION_FACTOR_ID_PARAM_DESCRIPTION,
  UPDATE_UOM_CONVERSION_FACTOR_SUMMARY,
} from '../constants/uom-conversion-factor.swagger';
import { CreateUomConversionFactorNestedDTO } from '../dto/create-uom-conversion-factor-nested.dto';
import { UomConversionFactorResponseDTO } from '../dto/uom-conversion-factor-response.dto';
import { UpdateUomConversionFactorDTO } from '../dto/update-uom-conversion-factor.dto';
import { UomConversionFactor } from '../entities/uom-conversion-factor.entity';
import { UomConversionFactorsService } from '../services/uom-conversion-factors.service';

@ResourceType('uom-conversion-factors')
@ApiTags('UOM Conversion Factors')
@Controller('products')
export class UomConversionFactorsController {
  constructor(
    private readonly uomConversionFactorsService: UomConversionFactorsService,
  ) {}

  @Post(':product_id/uom-conversions')
  @RequirePermission('product:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_UOM_CONVERSION_FACTOR_SUMMARY })
  @ApiParam({ name: 'product_id', description: 'Product ID' })
  @ApiJsonApiCreatedResponse(
    'uom-conversion-factors',
    UomConversionFactorResponseDTO,
  )
  create(
    @Param('product_id', ParseUuidParamPipe) productId: string,
    @Body() createDTO: CreateUomConversionFactorNestedDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<UomConversionFactor> {
    return this.uomConversionFactorsService.create(
      { ...createDTO, product_id: productId },
      currentUser,
    );
  }

  @Get(':product_id/uom-conversions')
  @RequirePermission('product:view')
  @ApiOperation({ summary: GET_UOM_CONVERSION_FACTORS_SUMMARY })
  @ApiParam({ name: 'product_id', description: 'Product ID' })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'uom-conversion-factors',
    HttpStatus.OK,
    UomConversionFactorResponseDTO,
  )
  findPaginated(
    @Param('product_id', ParseUuidParamPipe) productId: string,
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<UomConversionFactor[]>> {
    return this.uomConversionFactorsService.findPaginatedByProductId(
      productId,
      query,
    );
  }

  @Get(':product_id/uom-conversions/:conversion_id')
  @RequirePermission('product:view')
  @ApiOperation({ summary: GET_UOM_CONVERSION_FACTOR_SUMMARY })
  @ApiParam({ name: 'product_id', description: 'Product ID' })
  @ApiParam({
    name: 'conversion_id',
    description: UOM_CONVERSION_FACTOR_ID_PARAM_DESCRIPTION,
  })
  @ApiJsonApiResponse(
    'uom-conversion-factors',
    HttpStatus.OK,
    UomConversionFactorResponseDTO,
  )
  findOne(
    @Param('conversion_id', ParseUuidParamPipe) id: string,
  ): Promise<UomConversionFactor> {
    return this.uomConversionFactorsService.findById(id);
  }

  @Put(':product_id/uom-conversions/:conversion_id')
  @RequirePermission('product:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_UOM_CONVERSION_FACTOR_SUMMARY })
  @ApiParam({ name: 'product_id', description: 'Product ID' })
  @ApiParam({
    name: 'conversion_id',
    description: UOM_CONVERSION_FACTOR_ID_PARAM_DESCRIPTION,
  })
  @ApiJsonApiResponse(
    'uom-conversion-factors',
    HttpStatus.OK,
    UomConversionFactorResponseDTO,
  )
  update(
    @Param('conversion_id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateUomConversionFactorDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<UomConversionFactor> {
    return this.uomConversionFactorsService.update(id, updateDTO, currentUser);
  }

  @Delete(':product_id/uom-conversions/:conversion_id')
  @RequirePermission('product:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_UOM_CONVERSION_FACTOR_SUMMARY })
  @ApiParam({ name: 'product_id', description: 'Product ID' })
  @ApiParam({
    name: 'conversion_id',
    description: UOM_CONVERSION_FACTOR_ID_PARAM_DESCRIPTION,
  })
  softDelete(
    @Param('conversion_id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return this.uomConversionFactorsService.delete(id, true, currentUser);
  }
}
