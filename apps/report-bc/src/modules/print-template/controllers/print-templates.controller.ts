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
  ParseUuidParamPipe,
  RequirePermission,
  type IUserSession,
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
  CREATE_PRINT_TEMPLATE_SUMMARY,
  DELETE_PRINT_TEMPLATE_SUMMARY,
  GET_PRINT_TEMPLATE_SUMMARY,
  GET_PRINT_TEMPLATES_SUMMARY,
  PRINT_TEMPLATE_ID_PARAM_DESCRIPTION,
  UPDATE_PRINT_TEMPLATE_SUMMARY,
} from '../constants/print-template.swagger';
import { CreatePrintTemplateDTO } from '../dto/create-print-template.dto';
import { PrintTemplateResponseDTO } from '../dto/print-template-response.dto';
import { UpdatePrintTemplateDTO } from '../dto/update-print-template.dto';
import { PrintTemplate } from '../entities/print-template.entity';
import { PrintTemplatesService } from '../services/print-templates.service';

@ResourceType('print-templates')
@ApiTags('Print Templates')
@Controller('print-templates')
export class PrintTemplatesController extends BaseControllerOperations<
  PrintTemplate,
  CreatePrintTemplateDTO,
  UpdatePrintTemplateDTO,
  PrintTemplatesService
> {
  constructor(printTemplatesService: PrintTemplatesService) {
    super(printTemplatesService);
  }

  @Post()
  @RequirePermission('report:print_template_create', {
    th: 'สร้างเทมเพลตพิมพ์เอกสาร',
    en: 'Create print template',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_PRINT_TEMPLATE_SUMMARY })
  @ApiJsonApiCreatedResponse('print-templates', PrintTemplateResponseDTO)
  create(
    @Body() createDTO: CreatePrintTemplateDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<PrintTemplate> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('report:print_template_read', {
    th: 'ดูรายการเทมเพลตพิมพ์เอกสาร',
    en: 'View print templates',
  })
  @ApiOperation({ summary: GET_PRINT_TEMPLATES_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'print-templates',
    HttpStatus.OK,
    PrintTemplateResponseDTO,
  )
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<PrintTemplate[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('report:print_template_read', {
    th: 'ดูรายการเทมเพลตพิมพ์เอกสาร',
    en: 'View print templates',
  })
  @ApiOperation({ summary: GET_PRINT_TEMPLATE_SUMMARY })
  @ApiParam({ name: 'id', description: PRINT_TEMPLATE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse(
    'print-templates',
    HttpStatus.OK,
    PrintTemplateResponseDTO,
  )
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<PrintTemplate> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('report:print_template_update', {
    th: 'แก้ไขเทมเพลตพิมพ์เอกสาร',
    en: 'Update print template',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_PRINT_TEMPLATE_SUMMARY })
  @ApiParam({ name: 'id', description: PRINT_TEMPLATE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse(
    'print-templates',
    HttpStatus.OK,
    PrintTemplateResponseDTO,
  )
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdatePrintTemplateDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<PrintTemplate> {
    return super.update(id, updateDTO, currentUser);
  }

  @Delete(':id')
  @RequirePermission('report:print_template_delete', {
    th: 'ลบเทมเพลตพิมพ์เอกสาร',
    en: 'Delete print template',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_PRINT_TEMPLATE_SUMMARY })
  @ApiParam({ name: 'id', description: PRINT_TEMPLATE_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }
}
