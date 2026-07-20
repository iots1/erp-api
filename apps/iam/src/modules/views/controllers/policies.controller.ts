import { Controller, Get, Param, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { ParseUuidParamPipe, Public } from '@lib/common';
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

  @Get('new')
  @Public()
  @Render('pages/policies/form')
  newPage(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - สร้าง Policy ใหม่',
      policyId: null,
      ...buildAdminViewConfig(this.configService),
    };
  }

  @Get(':id/edit')
  @Public()
  @Render('pages/policies/form')
  editPage(@Param('id', ParseUuidParamPipe) id: string): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - แก้ไข Policy',
      policyId: id,
      ...buildAdminViewConfig(this.configService),
    };
  }
}
