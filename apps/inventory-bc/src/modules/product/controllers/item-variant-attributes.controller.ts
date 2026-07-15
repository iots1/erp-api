import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
  IResponsePaginatedService,
  RequirePermission,
  ParseUuidParamPipe,
} from '@lib/common';
import { ApiJsonApiCollectionResponse } from '@lib/common/decorators/json-api-response.decorator';
import { ResourceType } from '@lib/common/decorators/resource-type.decorator';
import { ValidatedQuery } from '@lib/common/decorators/validated-query.decorator';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';

import { ItemVariantAttributeResponseDTO } from '../dto/item-variant-attribute-response.dto';
import { ItemVariantAttribute } from '../entities/item-variant-attribute.entity';
import { ItemVariantAttributesService } from '../services/item-variant-attributes.service';

@ResourceType('item-variant-attributes')
@ApiTags('Item Variant Attributes')
@Controller('products')
export class ItemVariantAttributesController {
  constructor(
    private readonly itemVariantAttributesService: ItemVariantAttributesService,
  ) {}

  @Get(':product_id/variant-attributes')
  @RequirePermission('product:view')
  @ApiOperation({
    summary:
      'Get the attribute values that distinguish a generated variant product',
  })
  @ApiParam({ name: 'product_id', description: 'Variant product ID' })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'item-variant-attributes',
    HttpStatus.OK,
    ItemVariantAttributeResponseDTO,
  )
  findPaginated(
    @Param('product_id', ParseUuidParamPipe) productId: string,
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<ItemVariantAttribute[]>> {
    return this.itemVariantAttributesService.findPaginatedByVariantProductId(
      productId,
      query,
    );
  }
}
