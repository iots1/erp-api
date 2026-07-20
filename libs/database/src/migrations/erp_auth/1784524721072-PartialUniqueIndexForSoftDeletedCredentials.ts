import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `credentials.username` was a plain UNIQUE constraint, which applies to
 * *every* row regardless of `is_deleted` — so soft-deleting a credential
 * permanently blocked that username from ever being reused. Same defect as
 * erp_iam.users.username (see
 * PartialUniqueIndexForSoftDeletedUsers1784524707897 in erp_iam). Replaces it
 * with a partial unique index scoped to live rows (`WHERE is_deleted =
 * false`), matching the entity's `@Index(..., { unique: true, where:
 * 'is_deleted = false' })`.
 */
export class PartialUniqueIndexForSoftDeletedCredentials1784524721072
  implements MigrationInterface
{
  name = 'PartialUniqueIndexForSoftDeletedCredentials1784524721072';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "credentials" DROP CONSTRAINT "uq_credentials_username"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_credentials_username" ON "credentials" ("username") WHERE is_deleted = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_credentials_username"`);
    await queryRunner.query(
      `ALTER TABLE "credentials" ADD CONSTRAINT "uq_credentials_username" UNIQUE ("username")`,
    );
  }
}
