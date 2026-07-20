import { Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { Policy } from '../../policies/entities/policy.entity';
import { User } from '../../users/entities/user.entity';

@Entity({
  name: 'roles',
  database: ErpDatabases.IAM,
  comment: 'บทบาท — ROLE_* ผูกกับ policies ผ่าน roles_policies',
})
/**
 * Partial unique index instead of a plain column constraint — `code` must be
 * unique only among *live* rows, so a soft-deleted role's code can be reused
 * by a new one (a plain UNIQUE constraint would collide with the
 * soft-deleted row forever, since delete() never touches `code`).
 */
@Index('uq_roles_code', ['code'], { unique: true, where: 'is_deleted = false' })
export class Role extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    comment:
      'รหัสบทบาท เช่น ROLE_WAREHOUSE_MANAGER (unique เฉพาะแถวที่ยังไม่ถูกลบ) — uq_roles_code',
  })
  code: string;

  @Column({ type: 'varchar', length: 200, comment: 'ชื่อบทบาท (ไทย)' })
  name_th: string;

  @Column({ type: 'varchar', length: 200, comment: 'ชื่อบทบาท (English)' })
  name_en: string;

  @Column({ type: 'text', nullable: true, comment: 'คำอธิบาย' })
  description: string | null;

  /** Owning side — manages the roles_policies join table (role_id, policy_id). */
  @ManyToMany(() => Policy, (policy) => policy.roles, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'roles_policies',
    joinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_roles_policies_role_id',
    },
    inverseJoinColumn: {
      name: 'policy_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_roles_policies_policy_id',
    },
  })
  policies: Policy[];

  /**
   * Inverse side — owning side (JoinTable) lives on User.roles. TypeORM
   * takes the inverse FK's (users_roles.role_id) ON DELETE behavior from
   * *this* side's `onDelete`, not the owning side's — must be set here too.
   */
  @ManyToMany(() => User, (user) => user.roles, { onDelete: 'CASCADE' })
  users: User[];
}
