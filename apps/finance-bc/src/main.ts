import { bootstrapApplication } from '@lib/common';

import { FinanceBcModule } from './finance-bc.module';

async function bootstrap(): Promise<void> {
  await bootstrapApplication({
    module: FinanceBcModule,
    globalPrefixNameEnv: 'FINANCE_PREFIX_NAME',
    globalPrefixVersionEnv: 'FINANCE_PREFIX_VERSION',
    defaultGlobalPrefixName: 'finance',
    defaultGlobalPrefixVersion: 'v1',
    httpPortEnv: 'FINANCE_BC_MODULE_HTTP_PORT',
    microservice: 'Finance',
    swagger: {
      title: 'Finance API',
      description: 'Accounting — journals, ledgers, and P&L.',
      tag: 'finance',
    },
    jwtAuth: { name: 'access-token' },
  });
}

void bootstrap();
