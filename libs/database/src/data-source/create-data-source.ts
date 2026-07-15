import 'dotenv/config';

import { DataSource } from 'typeorm';

/**
 * Builds a standalone TypeORM DataSource for the TypeORM CLI (migrations).
 * One DataSource per Bounded Context database; runtime connections are
 * configured in DatabaseModule instead.
 *
 * @param envPrefix     env-var prefix for connection settings (e.g. `TRAINER_DB`)
 * @param appDir        the BC's app folder under `apps/` (entities live here)
 * @param migrationsDir folder under `libs/database/src/migrations` for this BC
 */
export function createDataSource(
  envPrefix: string,
  appDir: string,
  migrationsDir: string,
): DataSource {
  const env = (key: string): string | undefined =>
    process.env[`${envPrefix}_${key}`];

  return new DataSource({
    type: 'postgres',
    host: env('HOST') ?? 'localhost',
    port: Number(env('PORT') ?? 5432),
    username: env('USERNAME') ?? 'postgres',
    password: env('PASSWORD') ?? 'postgres',
    database: env('NAME') ?? `erp_${migrationsDir.replace('erp_', '')}`,
    // ts-node resolves the source globs; the compiled build resolves the dist globs.
    entities: [
      `apps/${appDir}/**/*.entity.ts`,
      `dist/apps/${appDir}/**/*.entity.js`,
    ],
    migrations: [
      `libs/database/src/migrations/${migrationsDir}/*.ts`,
      `dist/libs/database/src/migrations/${migrationsDir}/*.js`,
    ],
    synchronize: false,
    logging: ['error', 'migration'],
  });
}
