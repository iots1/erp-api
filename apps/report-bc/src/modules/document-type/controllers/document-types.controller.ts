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
  CREATE_DOCUMENT_TYPE_SUMMARY,
  DELETE_DOCUMENT_TYPE_SUMMARY,
  DOCUMENT_TYPE_ID_PARAM_DESCRIPTION,
  GENERATE_RUNNING_NUMBER_SUMMARY,
  GET_DOCUMENT_TYPE_SUMMARY,
  GET_DOCUMENT_TYPES_SUMMARY,
  GET_RUNNING_NUMBER_STATUS_SUMMARY,
  UPDATE_DOCUMENT_TYPE_SUMMARY,
} from '../constants/document-type.swagger';
import { CreateDocumentTypeDTO } from '../dto/create-document-type.dto';
import { DocumentTypeResponseDTO } from '../dto/document-type-response.dto';
import { GenerateRunningNumberResultDTO } from '../dto/generate-running-number-result.dto';
import { RunningNumberStatusDTO } from '../dto/running-number-status.dto';
import { UpdateDocumentTypeDTO } from '../dto/update-document-type.dto';
import { DocumentType } from '../entities/document-type.entity';
import { DocumentTypesService } from '../services/document-types.service';

@ResourceType('document-types')
@ApiTags('Document Types')
@Controller('document-types')
export class DocumentTypesController extends BaseControllerOperations<
  DocumentType,
  CreateDocumentTypeDTO,
  UpdateDocumentTypeDTO,
  DocumentTypesService
> {
  constructor(documentTypesService: DocumentTypesService) {
    super(documentTypesService);
  }

  @Post()
  @RequirePermission('report:document_type_create', {
    th: 'สร้างประเภทเอกสาร',
    en: 'Create document type',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: CREATE_DOCUMENT_TYPE_SUMMARY })
  @ApiJsonApiCreatedResponse('document-types', DocumentTypeResponseDTO)
  create(
    @Body() createDTO: CreateDocumentTypeDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<DocumentType> {
    return super.create(createDTO, currentUser);
  }

  @Get()
  @RequirePermission('report:document_type_read', {
    th: 'ดูรายการประเภทเอกสาร',
    en: 'View document types',
  })
  @ApiOperation({ summary: GET_DOCUMENT_TYPES_SUMMARY })
  @ApiQuery({ type: QueryParamsDTO })
  @ApiJsonApiCollectionResponse(
    'document-types',
    HttpStatus.OK,
    DocumentTypeResponseDTO,
  )
  findPaginated(
    @ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<DocumentType[]>> {
    return super.findPaginated(query);
  }

  @Get(':id')
  @RequirePermission('report:document_type_read', {
    th: 'ดูรายการประเภทเอกสาร',
    en: 'View document types',
  })
  @ApiOperation({ summary: GET_DOCUMENT_TYPE_SUMMARY })
  @ApiParam({ name: 'id', description: DOCUMENT_TYPE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('document-types', HttpStatus.OK, DocumentTypeResponseDTO)
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<DocumentType> {
    return super.findOne(id);
  }

  @Put(':id')
  @RequirePermission('report:document_type_update', {
    th: 'แก้ไขประเภทเอกสาร',
    en: 'Update document type',
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: UPDATE_DOCUMENT_TYPE_SUMMARY })
  @ApiParam({ name: 'id', description: DOCUMENT_TYPE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('document-types', HttpStatus.OK, DocumentTypeResponseDTO)
  update(
    @Param('id', ParseUuidParamPipe) id: string,
    @Body() updateDTO: UpdateDocumentTypeDTO,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<DocumentType> {
    return super.update(id, updateDTO, currentUser);
  }

  @Delete(':id')
  @RequirePermission('report:document_type_delete', {
    th: 'ลบประเภทเอกสาร',
    en: 'Delete document type',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: DELETE_DOCUMENT_TYPE_SUMMARY })
  @ApiParam({ name: 'id', description: DOCUMENT_TYPE_ID_PARAM_DESCRIPTION })
  softDelete(
    @Param('id', ParseUuidParamPipe) id: string,
    @CurrentUser() currentUser: IUserSession,
  ): Promise<void> {
    return super.softDelete(id, currentUser);
  }

  @Get(':id/running-number')
  @RequirePermission('report:document_type_running_number_read', {
    th: 'ดูสถานะเลขที่เอกสาร',
    en: 'View running number status',
  })
  @ApiOperation({ summary: GET_RUNNING_NUMBER_STATUS_SUMMARY })
  @ApiParam({ name: 'id', description: DOCUMENT_TYPE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiResponse('document-types', HttpStatus.OK, RunningNumberStatusDTO)
  getRunningNumberStatus(
    @Param('id', ParseUuidParamPipe) id: string,
  ): Promise<RunningNumberStatusDTO> {
    return this.service.getRunningNumberStatus(id);
  }

  @Post(':id/running-number/next')
  @RequirePermission('report:document_type_running_number_generate', {
    th: 'ออกเลขที่เอกสารถัดไป',
    en: 'Generate next running number',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: GENERATE_RUNNING_NUMBER_SUMMARY })
  @ApiParam({ name: 'id', description: DOCUMENT_TYPE_ID_PARAM_DESCRIPTION })
  @ApiJsonApiCreatedResponse('document-types', GenerateRunningNumberResultDTO)
  generateNextRunningNumber(
    @Param('id', ParseUuidParamPipe) id: string,
  ): Promise<GenerateRunningNumberResultDTO> {
    return this.service.generateNextRunningNumber(id);
  }
}
