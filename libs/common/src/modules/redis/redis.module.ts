import { Global, Module } from '@nestjs/common';

import Redis from 'ioredis';

import { RedisService } from '@lib/common/enum/app-microservice.enum';
import { ConfigModule, ConfigService } from '@lib/config';

/**
 * Global shared ioredis client (token {@link RedisService.name}), used by
 * `MicroserviceClientService` for caching microservice responses. Connects using
 * the same `REDIS_*` env keys as the `auth` service's session store.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RedisService.name,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis =>
        new Redis({
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          username: config.get<string>('REDIS_USERNAME'),
          password: config.get<string>('REDIS_PASSWORD'),
          db: config.get<number>('REDIS_DB'),
        }),
    },
  ],
  exports: [RedisService.name],
})
export class RedisModule {}
