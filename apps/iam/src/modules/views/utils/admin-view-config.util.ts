import { ConfigService } from '@lib/config';

import { getAssetVersion } from './asset-version.util';

/** Common EJS locals every admin-shell page (dashboard/users/roles/...) needs. */
export interface IAdminViewConfig {
  prefix: string;
  authApiBase: string;
  reportApiBase: string;
  assetVersion: string;
}

export function buildAdminViewConfig(
  configService: ConfigService,
): IAdminViewConfig {
  const prefixName = configService.get<string>('IAM_PREFIX_NAME') ?? 'iam';
  const prefixVersion = configService.get<string>('IAM_PREFIX_VERSION') ?? 'v1';
  const prefix = `${prefixName}/${prefixVersion}`;

  const authPrefixName =
    configService.get<string>('AUTH_PREFIX_NAME') ?? 'auth';
  const authPrefixVersion =
    configService.get<string>('AUTH_PREFIX_VERSION') ?? 'v1';
  const authPublicUrl =
    configService.get<string>('AUTH_PUBLIC_URL') ?? 'http://localhost:3001';
  const authApiBase = `${authPublicUrl.replace(/\/$/, '')}/${authPrefixName}/${authPrefixVersion}`;

  // report-bc — used by the print-templates admin pages, which are hosted
  // in iam's views but manage a resource that lives in report-bc's own DB.
  const reportPrefixName =
    configService.get<string>('REPORT_PREFIX_NAME') ?? 'report-bc';
  const reportPrefixVersion =
    configService.get<string>('REPORT_PREFIX_VERSION') ?? 'v1';
  const reportPublicUrl =
    configService.get<string>('REPORT_PUBLIC_URL') ?? 'http://localhost:3007';
  const reportApiBase = `${reportPublicUrl.replace(/\/$/, '')}/${reportPrefixName}/${reportPrefixVersion}`;

  return {
    prefix,
    authApiBase,
    reportApiBase,
    assetVersion: getAssetVersion(),
  };
}
