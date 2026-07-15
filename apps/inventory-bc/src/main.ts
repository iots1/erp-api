import { bootstrapApplication } from '@lib/common';

import { InventoryBcModule } from './inventory-bc.module';

async function bootstrap(): Promise<void> {
  await bootstrapApplication({
    module: InventoryBcModule,
    globalPrefixNameEnv: 'INVENTORY_PREFIX_NAME',
    globalPrefixVersionEnv: 'INVENTORY_PREFIX_VERSION',
    defaultGlobalPrefixName: 'inventory',
    defaultGlobalPrefixVersion: 'v1',
    httpPortEnv: 'INVENTORY_BC_MODULE_HTTP_PORT',
    microservice: 'Inventory',
    swagger: {
      title: 'Inventory API',
      description: 'Core stock & lot management (FIFO/FEFO, quantity on hand).',
      tag: 'inventory',
    },
    jwtAuth: { name: 'access-token' },
  });
}

void bootstrap();
