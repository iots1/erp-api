import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `roles.code` and `policies.code` were plain UNIQUE constraints, which
 * apply to *every* row regardless of `is_deleted` — so soft-deleting a role
 * or policy (delete() never touches `code`) permanently blocked that code
 * from ever being reused, since the soft-deleted row still occupied the
 * unique slot. Replaces both with a partial unique index scoped to live rows
 * (`WHERE is_deleted = false`), matching the entities' `@Index(..., {
 * unique: true, where: 'is_deleted = false' })`.
 */
export class PartialUniqueIndexForSoftDeletedCodes1784524471851
  implements MigrationInterface
{
  name = 'PartialUniqueIndexForSoftDeletedCodes1784524471851';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roles" DROP CONSTRAINT "uq_roles_code"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_roles_code" ON "roles" ("code") WHERE is_deleted = false`,
    );

    await queryRunner.query(
      `ALTER TABLE "policies" DROP CONSTRAINT "uq_policies_code"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_policies_code" ON "policies" ("code") WHERE is_deleted = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_policies_code"`);
    await queryRunner.query(
      `ALTER TABLE "policies" ADD CONSTRAINT "uq_policies_code" UNIQUE ("code")`,
    );

    await queryRunner.query(`DROP INDEX "uq_roles_code"`);
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "uq_roles_code" UNIQUE ("code")`,
    );
  }
}
