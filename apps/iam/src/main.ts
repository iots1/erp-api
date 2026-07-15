import { bootstrapApplication } from '@lib/common';

import { IamModule } from './iam.module';

async function bootstrap(): Promise<void> {
  await bootstrapApplication({
    module: IamModule,
    globalPrefixNameEnv: 'IAM_PREFIX_NAME',
    globalPrefixVersionEnv: 'IAM_PREFIX_VERSION',
    defaultGlobalPrefixName: 'iam',
    defaultGlobalPrefixVersion: 'v1',
    httpPortEnv: 'IAM_MODULE_HTTP_PORT',
    microservice: 'Iam',
    swagger: {
      title: 'IAM API',
      description:
        'Identity & access management (users, roles, permissions, policies).',
      tag: 'iam',
    },
    jwtAuth: { name: 'access-token' },
  });
}

void bootstrap();
