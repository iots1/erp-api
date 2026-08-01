import { Controller, Get, Param, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { ParseUuidParamPipe, Public } from '@lib/common';
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

  @Get('new')
  @Public()
  @Render('pages/users/form')
  newPage(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - เพิ่มบุคลากรใหม่',
      userId: null,
      ...buildAdminViewConfig(this.configService),
    };
  }

  @Get(':id/edit')
  @Public()
  @Render('pages/users/form')
  editPage(@Param('id', ParseUuidParamPipe) id: string): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - แก้ไขบุคลากร',
      userId: id,
      ...buildAdminViewConfig(this.configService),
    };
  }
}
