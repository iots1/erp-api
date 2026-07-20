import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pluralizes both sides of the two ManyToMany join table names so a reader
 * can't mistake them for singular-owner tables: role_policies -> roles_policies,
 * user_roles -> users_roles (matching the already-plural users/roles/policies
 * table names).
 *
 * Pure RENAME (table + constraints + indexes), not drop/recreate — these
 * tables already hold seeded rows and a naive `migration:generate` diff would
 * read the name change as "drop old table, create new table" and lose them.
 * The replacement PK_/IDX_ hash names were computed via TypeORM's own
 * DefaultNamingStrategy for the new table names, so this migration lands in
 * a genuinely clean state — a `migration:generate` run afterward diffs empty
 * for these two tables, instead of wanting to "fix" a stale hash forever.
 */
export class RenameRolePoliciesAndUserRolesJoinTables1784520151133 implements MigrationInterface {
  name = 'RenameRolePoliciesAndUserRolesJoinTables1784520151133';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "role_policies" RENAME TO "roles_policies"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles_policies" RENAME CONSTRAINT "PK_b87a97aaad1ffddb4cbfb94b384" TO "PK_32a074ebdfb79b0f175c497c691"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles_policies" RENAME CONSTRAINT "fk_role_policies_role_id" TO "fk_roles_policies_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles_policies" RENAME CONSTRAINT "fk_role_policies_policy_id" TO "fk_roles_policies_policy_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_fb4e9cdfe54bbf9efd1bbd96d4" RENAME TO "IDX_f4b0a0397a07ba8e7629cc345e"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_172c36e040c3f8233ce657d65a" RENAME TO "IDX_84e7bb620ec2239d570ac106d2"`,
    );

    await queryRunner.query(`ALTER TABLE "user_roles" RENAME TO "users_roles"`);
    await queryRunner.query(
      `ALTER TABLE "users_roles" RENAME CONSTRAINT "PK_23ed6f04fe43066df08379fd034" TO "PK_c525e9373d63035b9919e578a9c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_roles" RENAME CONSTRAINT "fk_user_roles_user_id" TO "fk_users_roles_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_roles" RENAME CONSTRAINT "fk_user_roles_role_id" TO "fk_users_roles_role_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_87b8888186ca9769c960e92687" RENAME TO "IDX_e4435209df12bc1f001e536017"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_b23c65e50a758245a33ee35fda" RENAME TO "IDX_1cf664021f00b9cc1ff95e17de"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER INDEX "IDX_1cf664021f00b9cc1ff95e17de" RENAME TO "IDX_b23c65e50a758245a33ee35fda"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_e4435209df12bc1f001e536017" RENAME TO "IDX_87b8888186ca9769c960e92687"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_roles" RENAME CONSTRAINT "fk_users_roles_role_id" TO "fk_user_roles_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_roles" RENAME CONSTRAINT "fk_users_roles_user_id" TO "fk_user_roles_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_roles" RENAME CONSTRAINT "PK_c525e9373d63035b9919e578a9c" TO "PK_23ed6f04fe43066df08379fd034"`,
    );
    await queryRunner.query(`ALTER TABLE "users_roles" RENAME TO "user_roles"`);

    await queryRunner.query(
      `ALTER INDEX "IDX_84e7bb620ec2239d570ac106d2" RENAME TO "IDX_172c36e040c3f8233ce657d65a"`,
    );
    await queryRunner.query(
      `ALTER INDEX "IDX_f4b0a0397a07ba8e7629cc345e" RENAME TO "IDX_fb4e9cdfe54bbf9efd1bbd96d4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles_policies" RENAME CONSTRAINT "fk_roles_policies_policy_id" TO "fk_role_policies_policy_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles_policies" RENAME CONSTRAINT "fk_roles_policies_role_id" TO "fk_role_policies_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles_policies" RENAME CONSTRAINT "PK_32a074ebdfb79b0f175c497c691" TO "PK_b87a97aaad1ffddb4cbfb94b384"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles_policies" RENAME TO "role_policies"`,
    );
  }
}
