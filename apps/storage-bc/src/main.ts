import { bootstrapApplication } from '@lib/common';

import { StorageBcModule } from './storage-bc.module';

async function bootstrap(): Promise<void> {
  await bootstrapApplication({
    module: StorageBcModule,
    globalPrefixNameEnv: 'STORAGE_PREFIX_NAME',
    globalPrefixVersionEnv: 'STORAGE_PREFIX_VERSION',
    defaultGlobalPrefixName: 'storage',
    defaultGlobalPrefixVersion: 'v1',
    httpPortEnv: 'STORAGE_BC_MODULE_HTTP_PORT',
    microservice: 'Storage',
    swagger: {
      title: 'Storage API',
      description: 'File management — uploads and presigned URLs (MinIO).',
      tag: 'storage',
    },
    jwtAuth: { name: 'access-token' },
  });
}

void bootstrap();
