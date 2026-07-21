import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ClientProvider, ClientsModule } from '@nestjs/microservices';

import { AppMicroservice } from '@lib/common/enum/app-microservice.enum';
import { AccessKeyGuard } from '@lib/common/guards/access-key.guard';
import { AuthGuard } from '@lib/common/guards/auth.guard';
import { PermissionGuard } from '@lib/common/guards/permission.guard';
import { LogModule } from '@lib/common/modules/log/log.module';
import { RedisModule } from '@lib/common/modules/redis/redis.module';
import { GracefulShutdownService } from '@lib/common/services/graceful-shutdown.service';
import { MicroserviceClientService } from '@lib/common/services/microservice-client.service';
import { SessionStoreService } from '@lib/common/services/session-store.service';
import { buildClientProvider } from '@lib/common/utils/microservice-transport.util';
import { ConfigModule, ConfigService } from '@lib/config';

/**
 * Global shared module. Registers a TCP {@link ClientProxy} for every ERP
 * microservice (data-driven from {@link AppMicroservice}) plus the JWT module, so
 * any BC can inject another BC's client by its token, e.g.:
 *
 *   constructor(@Inject(AppMicroservice.Trainer.name) private trainer: ClientProxy) {}
 *
 * Connection host/port come from each service's env keys
 * (e.g. `TRAINER_BC_MODULE_MICROSERVICE_HOST` / `..._PORT`).
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    LogModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('SECRET_KEY'),
        // Per-token lifetimes are set at sign time in AuthService.
        signOptions: { expiresIn: '15m' },
      }),
    }),
    ClientsModule.registerAsync(
      Object.values(AppMicroservice).map((service) => ({
        name: service.name,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService): ClientProvider =>
          buildClientProvider(service, configService),
      })),
    ),
  ],
  providers: [
    GracefulShutdownService,
    MicroserviceClientService,
    SessionStoreService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AccessKeyGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [
    JwtModule,
    ClientsModule,
    ConfigModule,
    LogModule,
    RedisModule,
    GracefulShutdownService,
    MicroserviceClientService,
    SessionStoreService,
  ],
})
export class CommonModule {}
