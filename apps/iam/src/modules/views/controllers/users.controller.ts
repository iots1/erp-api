import { Controller, Get, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/users')
export class UsersViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/users/index')
  page(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - จัดการผู้ใช้งาน',
      ...buildAdminViewConfig(this.configService),
    };
  }
}
