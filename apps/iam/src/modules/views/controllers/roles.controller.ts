import { Controller, Get, Param, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { ParseUuidParamPipe, Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/roles')
export class RolesViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/roles/index')
  page(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - สิทธิ์การใช้งาน (Roles)',
      ...buildAdminViewConfig(this.configService),
    };
  }

  @Get('new')
  @Public()
  @Render('pages/roles/form')
  newPage(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - เพิ่มสิทธิ์การใช้งานใหม่ (Roles)',
      roleId: null,
      ...buildAdminViewConfig(this.configService),
    };
  }

  @Get(':id/edit')
  @Public()
  @Render('pages/roles/form')
  editPage(@Param('id', ParseUuidParamPipe) id: string): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - แก้ไขสิทธิ์การใช้งาน (Roles)',
      roleId: id,
      ...buildAdminViewConfig(this.configService),
    };
  }
}
