import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Role<->Policy and User<->Role move from hand-rolled junction entities
 * (RolePolicy, UserRole — each with its own id/audit columns) to plain
 * TypeORM-managed @ManyToMany join tables. role_policies/user_roles keep
 * their name and FK column names, but lose their own id + audit trail
 * (created_by/updated_by/timestamps/soft-delete) — TypeORM manages a plain
 * join table as just the two FK columns forming a composite PK. This is a
 * real, intentional loss: per-assignment "who attached this policy to this
 * role, and when" is no longer recorded (down() cannot recover it — dropped
 * data has no source to restore from).
 *
 * PK/auxiliary-index names below (PK_b87a..., IDX_87b8...) are TypeORM's own
 * deterministic hash names for this table+column combination (confirmed
 * stable across repeated `migration:generate` runs) — left as generated
 * rather than renamed to pk_/idx_, since an implicitly-managed join table
 * has no entity-level decorator to pin a custom name, and renaming would
 * just cause the next generate to want to "fix" it back.
 */
export class SimplifyRolePoliciesUserRolesJoinTables1784481789208 implements MigrationInterface {
  name = 'SimplifyRolePoliciesUserRolesJoinTables1784481789208';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP CONSTRAINT "fk_role_policies_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP CONSTRAINT "fk_role_policies_policy_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_user_roles_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_role_policies_role_id"`);
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "uq_user_roles_user_id_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP CONSTRAINT "uq_role_policies_role_id_policy_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_pkey"`,
    );
    await queryRunner.query(`ALTER TABLE "user_roles" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP COLUMN "created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP COLUMN "updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP COLUMN "is_deleted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP COLUMN "deleted_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP COLUMN "deleted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP COLUMN "deleted_by"`,
    );

    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP CONSTRAINT "role_policies_pkey"`,
    );
    await queryRunner.query(`ALTER TABLE "role_policies" DROP COLUMN "id"`);
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP COLUMN "created_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP COLUMN "updated_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP COLUMN "is_deleted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP COLUMN "deleted_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP COLUMN "deleted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP COLUMN "deleted_by"`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "PK_23ed6f04fe43066df08379fd034" PRIMARY KEY ("user_id", "role_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD CONSTRAINT "PK_b87a97aaad1ffddb4cbfb94b384" PRIMARY KEY ("role_id", "policy_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_87b8888186ca9769c960e92687" ON "user_roles" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b23c65e50a758245a33ee35fda" ON "user_roles" ("role_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fb4e9cdfe54bbf9efd1bbd96d4" ON "role_policies" ("role_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_172c36e040c3f8233ce657d65a" ON "role_policies" ("policy_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD CONSTRAINT "fk_role_policies_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD CONSTRAINT "fk_role_policies_policy_id" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  /**
   * Restores the id/audit columns and prior constraint shape, but NOT the
   * historical audit values themselves (who/when each row was originally
   * created) — that data was dropped in up() and has no source to restore
   * from. New defaults (uuid_generate_v4() / now()) apply only to rows
   * inserted after this rollback runs.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP CONSTRAINT "fk_role_policies_policy_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP CONSTRAINT "fk_role_policies_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "fk_user_roles_user_id"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_172c36e040c3f8233ce657d65a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fb4e9cdfe54bbf9efd1bbd96d4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b23c65e50a758245a33ee35fda"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_87b8888186ca9769c960e92687"`,
    );

    await queryRunner.query(
      `ALTER TABLE "role_policies" DROP CONSTRAINT "PK_b87a97aaad1ffddb4cbfb94b384"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" DROP CONSTRAINT "PK_23ed6f04fe43066df08379fd034"`,
    );

    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD "deleted_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD "deleted_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD "is_deleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD "updated_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD "created_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD CONSTRAINT "role_policies_pkey" PRIMARY KEY ("id")`,
    );

    await queryRunner.query(`ALTER TABLE "user_roles" ADD "deleted_by" uuid`);
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD "deleted_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD "is_deleted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "user_roles" ADD "updated_by" uuid`);
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "user_roles" ADD "created_by" uuid`);
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD "id" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD CONSTRAINT "uq_role_policies_role_id_policy_id" UNIQUE ("role_id", "policy_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "uq_user_roles_user_id_role_id" UNIQUE ("user_id", "role_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_role_policies_role_id" ON "role_policies" ("role_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_roles_user_id" ON "user_roles" ("user_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD CONSTRAINT "fk_role_policies_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_policies" ADD CONSTRAINT "fk_role_policies_policy_id" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" ADD CONSTRAINT "fk_user_roles_role_id" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
