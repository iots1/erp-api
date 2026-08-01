import { Controller, Get, Param, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { ParseUuidParamPipe, Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/document-types')
export class DocumentTypesViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/document-types/index')
  page(): Record<string, unknown> {
    return {
      title: 'Admin Console - ประเภทเอกสาร (Document Types)',
      ...buildAdminViewConfig(this.configService),
    };
  }

  @Get('new')
  @Public()
  @Render('pages/document-types/form')
  newPage(): Record<string, unknown> {
    return {
      title: 'Admin Console - สร้างประเภทเอกสาร (Document Types)',
      documentTypeId: null,
      ...buildAdminViewConfig(this.configService),
    };
  }

  @Get(':id/edit')
  @Public()
  @Render('pages/document-types/form')
  editPage(
    @Param('id', ParseUuidParamPipe) id: string,
  ): Record<string, unknown> {
    return {
      title: 'Admin Console - แก้ไขประเภทเอกสาร (Document Types)',
      documentTypeId: id,
      ...buildAdminViewConfig(this.configService),
    };
  }
}
