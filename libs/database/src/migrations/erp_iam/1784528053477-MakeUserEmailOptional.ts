import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `users.email` becomes optional — not every user account needs one.
 * `uq_users_email` (partial unique index, live rows only) still holds:
 * multiple NULLs never violate a unique index in Postgres.
 *
 * Trimmed by hand from the raw `migration:generate` output, which also
 * picked up unrelated pre-existing drift (redundant FK drop/recreate +
 * COMMENT churn on other tables) — noise from TypeORM's diff engine, not
 * part of this change. See `docs/plan-erp` backend-convention: "Review the
 * generated SQL before committing — the diff is a starting point, not
 * gospel."
 */
export class MakeUserEmailOptional1784528053477 implements MigrationInterface {
  name = 'MakeUserEmailOptional1784528053477';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."email" IS 'อีเมล (unique เฉพาะแถวที่ยังไม่ถูกลบ) — uq_users_email — ไม่บังคับกรอก'`,
    );
  }

  /** Fails if any row already has `email IS NULL` — that's expected: this
   * genuinely can't be undone once a null-email user exists without either
   * deleting those rows or backfilling a placeholder, neither of which this
   * migration should decide on the caller's behalf. */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."email" IS 'อีเมล (unique เฉพาะแถวที่ยังไม่ถูกลบ) — uq_users_email'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`,
    );
  }
}
