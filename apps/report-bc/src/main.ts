import { bootstrapApplication } from '@lib/common/utils/bootstrap.util';

import { ReportBcModule } from './report-bc.module';

async function bootstrap(): Promise<void> {
  await bootstrapApplication({
    module: ReportBcModule,
    globalPrefixNameEnv: 'REPORT_PREFIX_NAME',
    globalPrefixVersionEnv: 'REPORT_PREFIX_VERSION',
    defaultGlobalPrefixName: 'report',
    defaultGlobalPrefixVersion: 'v1',
    httpPortEnv: 'REPORT_BC_MODULE_HTTP_PORT',
    microservice: 'Report',
    swagger: {
      title: 'Report API',
      description: 'Analytics and cross-BC reporting (CQRS read models).',
      tag: 'report',
    },
    jwtAuth: { name: 'access-token' },
  });
}

void bootstrap();
