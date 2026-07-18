import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `permissions.is_manual` — the provenance flag that separates rows
 * created by an admin through the new iam-view "Permissions" page from rows
 * synced from code (`@RequirePermission()` / `data-permission` scan / the
 * ui-permissions manifest — see `sync-permissions.script.ts`).
 *
 * `permissions:sync` only ever touches `is_manual = false` rows (its own
 * inserts are always `is_manual = false`, and it never sets the column on
 * conflict), and `PermissionsController`'s DELETE endpoint refuses to remove
 * a row unless `is_manual = true` — together these guarantee an admin can
 * never delete a permission the code still declares, while still being free
 * to curate manually-added UI permissions.
 *
 * The migration:generate diff for this column pulled in a large amount of
 * unrelated comment/FK churn from pre-existing DB drift — trimmed here to
 * just the actual schema change (see CLAUDE.md: "the diff is a starting
 * point, not gospel").
 */
export class AddIsManualToPermissions1784350154799
  implements MigrationInterface
{
  name = 'AddIsManualToPermissions1784350154799';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "permissions" ADD "is_manual" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "permissions"."is_manual" IS 'true = เพิ่มด้วยมือผ่าน iam-view (Permissions page) · false = มาจาก permissions:sync (@RequirePermission()/data-permission scan) — sync ไม่แตะแถว is_manual=true เลย, และห้ามลบแถว is_manual=false ผ่าน API (ต้องแก้ที่ source แล้ว sync ใหม่)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "permissions" DROP COLUMN "is_manual"`);
  }
}
