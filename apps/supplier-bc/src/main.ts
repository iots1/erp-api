import { bootstrapApplication } from '@lib/common/utils/bootstrap.util';

import { SupplierBcModule } from './supplier-bc.module';

async function bootstrap(): Promise<void> {
  await bootstrapApplication({
    module: SupplierBcModule,
    globalPrefixNameEnv: 'SUPPLIER_PREFIX_NAME',
    globalPrefixVersionEnv: 'SUPPLIER_PREFIX_VERSION',
    defaultGlobalPrefixName: 'supplier',
    defaultGlobalPrefixVersion: 'v1',
    httpPortEnv: 'SUPPLIER_BC_MODULE_HTTP_PORT',
    microservice: 'Supplier',
    swagger: {
      title: 'Supplier API',
      description: 'Procurement — suppliers, purchase orders, goods receipt.',
      tag: 'supplier',
    },
    jwtAuth: { name: 'access-token' },
  });
}

void bootstrap();
