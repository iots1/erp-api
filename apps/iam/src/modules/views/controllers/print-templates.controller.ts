import { Controller, Get, Param, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { ParseUuidParamPipe, Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/print-templates')
export class PrintTemplatesViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/print-templates/index')
  page(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - เทมเพลตพิมพ์เอกสาร (Print Templates)',
      ...buildAdminViewConfig(this.configService),
    };
  }

  @Get('new')
  @Public()
  @Render('pages/print-templates/form')
  newPage(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - สร้างเทมเพลต (Print Templates)',
      printTemplateId: null,
      ...buildAdminViewConfig(this.configService),
    };
  }

  @Get(':id/edit')
  @Public()
  @Render('pages/print-templates/form')
  editPage(
    @Param('id', ParseUuidParamPipe) id: string,
  ): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - แก้ไขเทมเพลต (Print Templates)',
      printTemplateId: id,
      ...buildAdminViewConfig(this.configService),
    };
  }
}
