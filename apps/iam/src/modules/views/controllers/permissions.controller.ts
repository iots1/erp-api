import { Controller, Get, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/permissions')
export class PermissionsViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/permissions/index')
  page(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - จัดการสิทธิ์',
      ...buildAdminViewConfig(this.configService),
    };
  }
}
