import { Controller, Get, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/system-setting')
export class SystemSettingViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/system-setting/index')
  page(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - ตั้งค่าระบบ',
      ...buildAdminViewConfig(this.configService),
    };
  }
}
