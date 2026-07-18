import { Controller, Get, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/audit-logs')
export class AuditLogsViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/audit-logs/index')
  page(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - ประวัติการเข้าใช้งาน',
      ...buildAdminViewConfig(this.configService),
    };
  }
}
