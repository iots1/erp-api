import { Controller, Get, Param, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { ParseUuidParamPipe, Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/access-keys')
export class AccessKeysViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/access-keys/index')
  page(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - Access Keys',
      ...buildAdminViewConfig(this.configService),
    };
  }

  @Get('new')
  @Public()
  @Render('pages/access-keys/form')
  newPage(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - สร้าง Access Key (Access Keys)',
      accessKeyId: null,
      ...buildAdminViewConfig(this.configService),
    };
  }

  @Get(':id/edit')
  @Public()
  @Render('pages/access-keys/form')
  editPage(
    @Param('id', ParseUuidParamPipe) id: string,
  ): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - แก้ไข Access Key (Access Keys)',
      accessKeyId: id,
      ...buildAdminViewConfig(this.configService),
    };
  }
}
