import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ERP_DB_ENV_PREFIX, ErpDatabases } from '@lib/common';
import { ConfigModule } from '@lib/config';

/**
 * Database module providing one PostgreSQL connection per Bounded Context.
 *
 * Each BC owns its own database and registers only that connection:
 *   imports: [DatabaseModule.registerAsync(ErpDatabases.SALES)]
 *
 * The connection name equals the {@link ErpDatabases} value, so
 * `TypeOrmModule.forFeature([Entity], ErpDatabases.SALES)` and
 * `@InjectRepository(Entity, ErpDatabases.SALES)` resolve the right
 * connection. Connection settings are read from the BC's env prefix
 * (e.g. `SALES_DB_HOST`, `SALES_DB_PORT`, `SALES_DB_NAME`).
 */
@Module({})
export class DatabaseModule {
  static registerAsync(connectionName: ErpDatabases): DynamicModule {
    const prefix = ERP_DB_ENV_PREFIX[connectionName];

    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          name: connectionName,
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            // `TypeOrmCoreModule.onApplicationShutdown()` resolves its
            // DataSource token from these returned options (not from the
            // `name` passed to `forRootAsync` above) — without `name` here
            // it looks up the default `DataSource` token, finds nothing
            // (every BC is a named connection), throws, and NestJS's own
            // shutdown catch-all force-exits the process before HTTP
            // draining can finish. See reviews/graceful-shutdown-iam-2026-07-22.md.
            name: connectionName,
            type: 'postgres',
            host: configService.get<string>(`${prefix}_HOST`),
            port: configService.get<number>(`${prefix}_PORT`),
            username: configService.get<string>(`${prefix}_USERNAME`),
            password: configService.get<string>(`${prefix}_PASSWORD`),
            database:
              configService.get<string>(`${prefix}_NAME`) ?? connectionName,
            autoLoadEntities: true,
            synchronize:
              configService.get<boolean>(`${prefix}_SYNCHRONIZE`) ?? false,
            logging: configService.get<boolean>(`${prefix}_LOGGING`) ?? false,
            timezone: 'Z',
            // Per-PROCESS pool ceiling. Under PM2 cluster mode
            // (ecosystem.config.js) each worker opens its own pool, so the
            // real per-BC ceiling is `instances × max` — see that file's
            // "DB connection budget" comment before raising either number.
            extra: {
              max: 5,
              min: 1,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 2000,
            },
          }),
        }),
      ],
      exports: [TypeOrmModule],
    };
  }
}
