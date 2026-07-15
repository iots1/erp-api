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
  CREATE_ITEM_GROUP_SUMMARY,
  DELETE_ITEM_GROUP_SUMMARY,
  GET_ITEM_GROUP_SUMMARY,
  GET_ITEM_GROUPS_SUMMARY,
  ITEM_GROUP_ID_PARAM_DESCRIPTION,
  UPDATE_ITEM_GROUP_SUMMARY,
} from '../constants/item-group.swagger';
import { CreateItemGroupDTO } from '../dto/create-item-group.dto';
import { ItemGroupResponseDTO } from '../dto/item-group-response.dto';
import { UpdateItemGroupDTO } from '../dto/update-item-group.dto';
import { ItemGroup } from '../entities/item-group.entity';
import { ItemGroupsService } from '../services/item-groups.service';

@ResourceType('item-groups')
@ApiTags('Item Groups')
@Controller('item-groups')
export class ItemGroupsController extends BaseControllerOperations<
  ItemGroup,
  CreateItemGroupDTO,
  UpdateItemGroupDTO,
  ItemGroupsService
> {
  constructor(itemGroupsService: ItemGroupsService) {
    super(itemGroupsService);
  }

  @Post()
  @RequirePermission('item-group:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_ITEM_GROUP_SUMMARY })
  @ApiJsonApiCreatedResponse('item-groups', ItemGroupResponseDTO)
  create(
    @Body() createDTO: CreateItemGroupDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<ItemGroup> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('item-group:view')
  @ApiOperation({ summary: GET_ITEM_GROUPS_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'item-groups',
    HttpStatus.OK,
    ItemGroupResponseDTO,
  )
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<ItemGroup[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('item-group:view')
  @ApiOperation({ summary: GET_ITEM_GROUP_SUMMARY })
  @ApiParam({ name: 'id', description: ITEM_GROUP_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('item-groups', HttpStatus.OK, ItemGroupResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<ItemGroup> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('item-group:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_ITEM_GROUP_SUMMARY })
  @ApiParam({ name: 'id', description: ITEM_GROUP_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('item-groups', HttpStatus.OK, ItemGroupResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateItemGroupDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<ItemGroup> {
    return super.update(id, updateDTO, currentUser);
  }

  @Delete(':id')
  @RequirePermission('item-group:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_ITEM_GROUP_SUMMARY })
  @ApiParam({ name: 'id', description: ITEM_GROUP_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
