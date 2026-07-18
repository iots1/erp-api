import { Controller, Get, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/policies')
export class PoliciesViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/policies/index')
  page(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - นโยบายความปลอดภัย',
      ...buildAdminViewConfig(this.configService),
    };
  }
}
