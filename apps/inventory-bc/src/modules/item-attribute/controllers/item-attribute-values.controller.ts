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
  CREATE_ITEM_ATTRIBUTE_VALUE_SUMMARY,
  DELETE_ITEM_ATTRIBUTE_VALUE_SUMMARY,
  GET_ITEM_ATTRIBUTE_VALUE_SUMMARY,
  GET_ITEM_ATTRIBUTE_VALUES_SUMMARY,
  ITEM_ATTRIBUTE_VALUE_ID_PARAM_DESCRIPTION,
  UPDATE_ITEM_ATTRIBUTE_VALUE_SUMMARY,
} from '../constants/item-attribute.swagger';
import { CreateItemAttributeValueNestedDTO } from '../dto/create-item-attribute-value-nested.dto';
import { ItemAttributeValueResponseDTO } from '../dto/item-attribute-value-response.dto';
import { UpdateItemAttributeValueDTO } from '../dto/update-item-attribute-value.dto';
import { ItemAttributeValue } from '../entities/item-attribute-value.entity';
import { ItemAttributeValuesService } from '../services/item-attribute-values.service';

@ResourceType('item-attribute-values')
@ApiTags('Item Attribute Values')
@Controller('item-attributes')
export class ItemAttributeValuesController {
  constructor(
    private readonly itemAttributeValuesService: ItemAttributeValuesService,
  ) {}

  @Post(':attribute_id/values')
  @RequirePermission('item-attribute:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_ITEM_ATTRIBUTE_VALUE_SUMMARY })
  @ApiParam({ name: 'attribute_id', description: 'Item attribute ID' })
  @ApiJsonApiCreatedResponse(
    'item-attribute-values',
    ItemAttributeValueResponseDTO,
  )
  create(
    @Param('attribute_id', ParseUuidParamPipe) attributeId: string,
    @Body() createDTO: CreateItemAttributeValueNestedDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<ItemAttributeValue> {
    return this.itemAttributeValuesService.create(
      { ...createDTO, attribute_id: attributeId },
      currentUser,
    );
  }

  @Get(':attribute_id/values')
  @RequirePermission('item-attribute:view')
  @ApiOperation({ summary: GET_ITEM_ATTRIBUTE_VALUES_SUMMARY })
  @ApiParam({ name: 'attribute_id', description: 'Item attribute ID' })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'item-attribute-values',
    HttpStatus.OK,
    ItemAttributeValueResponseDTO,
  )
  findPaginated(
    @Param('attribute_id', ParseUuidParamPipe) attributeId: string,
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<ItemAttributeValue[]>> {
    return this.itemAttributeValuesService.findPaginatedByAttributeId(
      attributeId,
      query,
    );
  }

  @Get(':attribute_id/values/:value_id')
  @RequirePermission('item-attribute:view')
  @ApiOperation({ summary: GET_ITEM_ATTRIBUTE_VALUE_SUMMARY })
  @ApiParam({ name: 'attribute_id', description: 'Item attribute ID' })
  @ApiParam({
    name: 'value_id',
    description: ITEM_ATTRIBUTE_VALUE_ID_PARAM_DESCRIPTION,
  })
  @ApiJsonApiResponse(
    'item-attribute-values',
    HttpStatus.OK,
    ItemAttributeValueResponseDTO,
  )
  findOne(
    @Param('value_id', ParseUuidParamPipe) id: string,
  ): Promise<ItemAttributeValue> {
    return this.itemAttributeValuesService.findById(id);
  }

  @Put(':attribute_id/values/:value_id')
  @RequirePermission('item-attribute:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_ITEM_ATTRIBUTE_VALUE_SUMMARY })
  @ApiParam({ name: 'attribute_id', description: 'Item attribute ID' })
  @ApiParam({
    name: 'value_id',
    description: ITEM_ATTRIBUTE_VALUE_ID_PARAM_DESCRIPTION,
  })
  @ApiJsonApiResponse(
    'item-attribute-values',
    HttpStatus.OK,
    ItemAttributeValueResponseDTO,
  )
  update(
    @Param('value_id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateItemAttributeValueDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<ItemAttributeValue> {
    return this.itemAttributeValuesService.update(id, updateDTO, currentUser);
  }

  @Delete(':attribute_id/values/:value_id')
  @RequirePermission('item-attribute:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_ITEM_ATTRIBUTE_VALUE_SUMMARY })
  @ApiParam({ name: 'attribute_id', description: 'Item attribute ID' })
  @ApiParam({
    name: 'value_id',
    description: ITEM_ATTRIBUTE_VALUE_ID_PARAM_DESCRIPTION,
  })
  softDelete(
    @Param('value_id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return this.itemAttributeValuesService.delete(id, true, currentUser);
  }
}
