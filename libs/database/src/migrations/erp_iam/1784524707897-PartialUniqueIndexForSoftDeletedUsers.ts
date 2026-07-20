import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `users.username` and `users.email` were plain UNIQUE constraints, which
 * apply to *every* row regardless of `is_deleted` — so soft-deleting a user
 * (delete() never touches username/email) permanently blocked that
 * username/email from ever being reused, since the soft-deleted row still
 * occupied the unique slot. Same defect as roles.code/policies.code (see
 * PartialUniqueIndexForSoftDeletedCodes1784524471851). Replaces both with a
 * partial unique index scoped to live rows (`WHERE is_deleted = false`),
 * matching the entity's `@Index(..., { unique: true, where: 'is_deleted =
 * false' })`.
 */
export class PartialUniqueIndexForSoftDeletedUsers1784524707897
  implements MigrationInterface
{
  name = 'PartialUniqueIndexForSoftDeletedUsers1784524707897';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "uq_users_username"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_username" ON "users" ("username") WHERE is_deleted = false`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "uq_users_email"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") WHERE is_deleted = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_users_email"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "uq_users_email" UNIQUE ("email")`,
    );

    await queryRunner.query(`DROP INDEX "uq_users_username"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "uq_users_username" UNIQUE ("username")`,
    );
  }
}
