import { bootstrapApplication } from '@lib/common';

import { AuthModule } from './auth.module';

async function bootstrap(): Promise<void> {
  await bootstrapApplication({
    module: AuthModule,
    globalPrefixNameEnv: 'AUTH_PREFIX_NAME',
    globalPrefixVersionEnv: 'AUTH_PREFIX_VERSION',
    defaultGlobalPrefixName: 'auth',
    defaultGlobalPrefixVersion: 'v1',
    httpPortEnv: 'AUTH_MODULE_HTTP_PORT',
    microservice: 'Auth',
    swagger: {
      title: 'Auth API',
      description:
        'Auth service - JWT login/refresh/logout, credentials, login history, account blocking and security logs. Session state in Redis. Owns no user profile data (source of truth is iam-bc).',
      tag: 'auth',
    },
    jwtAuth: { name: 'access-token' },
  });
}

void bootstrap();
