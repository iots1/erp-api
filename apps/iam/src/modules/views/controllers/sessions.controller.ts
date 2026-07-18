import { Controller, Get, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/sessions')
export class SessionsViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/sessions/index')
  page(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - ผู้ใช้งานที่ออนไลน์',
      ...buildAdminViewConfig(this.configService),
    };
  }
}
