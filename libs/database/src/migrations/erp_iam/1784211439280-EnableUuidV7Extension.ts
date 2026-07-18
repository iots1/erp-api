import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable pgcrypto extension for UUID v7 generation.
 * UUID v7 is time-based and sortable, providing better database performance
 * compared to random v4 UUIDs for indexes and sequential operations.
 */
export class EnableUuidV7Extension1784211439280 implements MigrationInterface {
  name = 'EnableUuidV7Extension1784211439280';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP EXTENSION IF EXISTS "pgcrypto"');
  }
}
