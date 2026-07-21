import { bootstrapApplication } from '@lib/common/utils/bootstrap.util';

import { SalesBcModule } from './sales-bc.module';

async function bootstrap(): Promise<void> {
  await bootstrapApplication({
    module: SalesBcModule,
    globalPrefixNameEnv: 'SALES_PREFIX_NAME',
    globalPrefixVersionEnv: 'SALES_PREFIX_VERSION',
    defaultGlobalPrefixName: 'sales',
    defaultGlobalPrefixVersion: 'v1',
    httpPortEnv: 'SALES_BC_MODULE_HTTP_PORT',
    microservice: 'Sales',
    swagger: {
      title: 'Sales API',
      description: 'Sales orders, invoicing, and stock deduction.',
      tag: 'sales',
    },
    jwtAuth: { name: 'access-token' },
  });
}

void bootstrap();
