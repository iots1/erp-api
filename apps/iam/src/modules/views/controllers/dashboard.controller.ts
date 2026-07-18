import { Controller, Get, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/dashboard')
export class DashboardViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/dashboard/index')
  page(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - แดชบอร์ด',
      ...buildAdminViewConfig(this.configService),
    };
  }
}
