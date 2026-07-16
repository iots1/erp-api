import { Controller, Get, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { getAssetVersion } from '../utils/asset-version.util';

/**
 * Serves the iam-view admin UI (dashboard / users / roles / policies) as a
 * single EJS page — a dev/internal tool, not a documented API, hence
 * @ApiExcludeController + @Public() (the page itself is unauthenticated static
 * HTML; every API call it makes from the browser carries its own JWT).
 */
@ApiExcludeController()
@Controller('views/user-management')
export class UserManagementViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/user-management/index')
  page(): Record<string, unknown> {
    const prefixName =
      this.configService.get<string>('IAM_PREFIX_NAME') ?? 'iam';
    const prefixVersion =
      this.configService.get<string>('IAM_PREFIX_VERSION') ?? 'v1';
    const prefix = `${prefixName}/${prefixVersion}`;

    const authPrefixName =
      this.configService.get<string>('AUTH_PREFIX_NAME') ?? 'auth';
    const authPrefixVersion =
      this.configService.get<string>('AUTH_PREFIX_VERSION') ?? 'v1';
    const authPublicUrl =
      this.configService.get<string>('AUTH_PUBLIC_URL') ??
      'http://localhost:3001';
    const authApiBase = `${authPublicUrl.replace(/\/$/, '')}/${authPrefixName}/${authPrefixVersion}`;

    return {
      title: 'ERP IAM Admin - ระบบจัดการสิทธิ์ผู้ใช้งาน',
      prefix,
      authApiBase,
      assetVersion: getAssetVersion(),
    };
  }
}
