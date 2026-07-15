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
  CREATE_REORDER_LEVEL_SUMMARY,
  DELETE_REORDER_LEVEL_SUMMARY,
  GET_REORDER_LEVEL_SUMMARY,
  GET_REORDER_LEVELS_SUMMARY,
  REORDER_LEVEL_ID_PARAM_DESCRIPTION,
  UPDATE_REORDER_LEVEL_SUMMARY,
} from '../constants/reorder-level.swagger';
import { CreateReorderLevelNestedDTO } from '../dto/create-reorder-level-nested.dto';
import { ReorderLevelResponseDTO } from '../dto/reorder-level-response.dto';
import { UpdateReorderLevelDTO } from '../dto/update-reorder-level.dto';
import { ReorderLevel } from '../entities/reorder-level.entity';
import { ReorderLevelsService } from '../services/reorder-levels.service';

@ResourceType('reorder-levels')
@ApiTags('Reorder Levels')
@Controller('products')
export class ReorderLevelsController {
  constructor(private readonly reorderLevelsService: ReorderLevelsService) {}

  @Post(':product_id/reorder-levels')
  @RequirePermission('product:update')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_REORDER_LEVEL_SUMMARY })
  @ApiParam({ name: 'product_id', description: 'Product ID' })
  @ApiJsonApiCreatedResponse('reorder-levels', ReorderLevelResponseDTO)
  create(
    @Param('product_id', ParseUuidParamPipe) productId: string,
    @Body() createDTO: CreateReorderLevelNestedDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<ReorderLevel> {
    return this.reorderLevelsService.create(
      { ...createDTO, product_id: productId },
      currentUser,
    );
  }

  @Get(':product_id/reorder-levels')
  @RequirePermission('product:view')
  @ApiOperation({ summary: GET_REORDER_LEVELS_SUMMARY })
  @ApiParam({ name: 'product_id', description: 'Product ID' })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'reorder-levels',
    HttpStatus.OK,
    ReorderLevelResponseDTO,
  )
  findPaginated(
    @Param('product_id', ParseUuidParamPipe) productId: string,
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<ReorderLevel[]>> {
    return this.reorderLevelsService.findPaginatedByProductId(productId, query);
  }

  @Get(':product_id/reorder-levels/:reorder_level_id')
  @RequirePermission('product:view')
  @ApiOperation({ summary: GET_REORDER_LEVEL_SUMMARY })
  @ApiParam({ name: 'product_id', description: 'Product ID' })
  @ApiParam({
    name: 'reorder_level_id',
    description: REORDER_LEVEL_ID_PARAM_DESCRIPTION,
  })
  @ApiJsonApiResponse('reorder-levels', HttpStatus.OK, ReorderLevelResponseDTO)
  findOne(
    @Param('reorder_level_id', ParseUuidParamPipe) id: string,
  ): Promise<ReorderLevel> {
    return this.reorderLevelsService.findById(id);
  }

  @Put(':product_id/reorder-levels/:reorder_level_id')
  @RequirePermission('product:update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_REORDER_LEVEL_SUMMARY })
  @ApiParam({ name: 'product_id', description: 'Product ID' })
  @ApiParam({
    name: 'reorder_level_id',
    description: REORDER_LEVEL_ID_PARAM_DESCRIPTION,
  })
  @ApiJsonApiResponse('reorder-levels', HttpStatus.OK, ReorderLevelResponseDTO)
  update(
    @Param('reorder_level_id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateReorderLevelDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<ReorderLevel> {
    return this.reorderLevelsService.update(id, updateDTO, currentUser);
  }

  @Delete(':product_id/reorder-levels/:reorder_level_id')
  @RequirePermission('product:update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_REORDER_LEVEL_SUMMARY })
  @ApiParam({ name: 'product_id', description: 'Product ID' })
  @ApiParam({
    name: 'reorder_level_id',
    description: REORDER_LEVEL_ID_PARAM_DESCRIPTION,
  })
  softDelete(
    @Param('reorder_level_id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return this.reorderLevelsService.delete(id, true, currentUser);
  }
}
