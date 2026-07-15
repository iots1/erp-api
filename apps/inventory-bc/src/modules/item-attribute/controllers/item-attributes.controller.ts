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
  CREATE_ITEM_ATTRIBUTE_SUMMARY,
  DELETE_ITEM_ATTRIBUTE_SUMMARY,
  GET_ITEM_ATTRIBUTE_SUMMARY,
  GET_ITEM_ATTRIBUTES_SUMMARY,
  ITEM_ATTRIBUTE_ID_PARAM_DESCRIPTION,
  UPDATE_ITEM_ATTRIBUTE_SUMMARY,
} from '../constants/item-attribute.swagger';
import { CreateItemAttributeDTO } from '../dto/create-item-attribute.dto';
import { ItemAttributeResponseDTO } from '../dto/item-attribute-response.dto';
import { UpdateItemAttributeDTO } from '../dto/update-item-attribute.dto';
import { ItemAttribute } from '../entities/item-attribute.entity';
import { ItemAttributesService } from '../services/item-attributes.service';

@ResourceType('item-attributes')
@ApiTags('Item Attributes')
@Controller('item-attributes')
export class ItemAttributesController extends BaseControllerOperations<
  ItemAttribute,
  CreateItemAttributeDTO,
  UpdateItemAttributeDTO,
  ItemAttributesService
> {
  constructor(itemAttributesService: ItemAttributesService) {
    super(itemAttributesService);
  }

  @Post()
  @RequirePermission('item-attribute:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_ITEM_ATTRIBUTE_SUMMARY })
  @ApiJsonApiCreatedResponse('item-attributes', ItemAttributeResponseDTO)
  create(
    @Body() createDTO: CreateItemAttributeDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<ItemAttribute> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('item-attribute:view')
  @ApiOperation({ summary: GET_ITEM_ATTRIBUTES_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'item-attributes',
    HttpStatus.OK,
    ItemAttributeResponseDTO,
  )
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<ItemAttribute[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('item-attribute:view')
  @ApiOperation({ summary: GET_ITEM_ATTRIBUTE_SUMMARY })
  @ApiParam({ name: 'id', description: ITEM_ATTRIBUTE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse(
    'item-attributes',
    HttpStatus.OK,
    ItemAttributeResponseDTO,
  )
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<ItemAttribute> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('item-attribute:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_ITEM_ATTRIBUTE_SUMMARY })
  @ApiParam({ name: 'id', description: ITEM_ATTRIBUTE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse(
    'item-attributes',
    HttpStatus.OK,
    ItemAttributeResponseDTO,
  )
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateItemAttributeDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<ItemAttribute> {
    return super.update(id, updateDTO, currentUser);
  }

  @Delete(':id')
  @RequirePermission('item-attribute:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_ITEM_ATTRIBUTE_SUMMARY })
  @ApiParam({ name: 'id', description: ITEM_ATTRIBUTE_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
