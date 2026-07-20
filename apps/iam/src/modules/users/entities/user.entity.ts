import { Check, Column, Entity, Index, JoinTable, ManyToMany } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { Role } from '../../roles/entities/role.entity';

export type UserStatus = 'active' | 'pending' | 'suspended';

@Entity({
  name: 'users',
  database: ErpDatabases.IAM,
  comment: 'บัญชีผู้ใช้ — source of truth ของผู้ใช้งานทั้งระบบ',
})
@Index('idx_users_status', ['status'])
@Check('chk_users_status', `"status" IN ('active', 'pending', 'suspended')`)
export class User extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    comment: 'ชื่อผู้ใช้ (unique) — uq_users_username',
  })
  username: string;

  @Column({ type: 'varchar', length: 50, comment: 'รหัสพนักงาน' })
  employee_id: string;

  @Column({ type: 'varchar', length: 200, comment: 'ชื่อ-นามสกุล' })
  full_name: string;

  @Column({
    type: 'varchar',
    length: 200,
    unique: true,
    comment: 'อีเมล (unique) — uq_users_email',
  })
  email: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: 'แผนก/สังกัด (ใช้ทำ condition ABAC ได้)',
  })
  department: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    comment: 'active | pending | suspended',
  })
  status: UserStatus;

  /** Owning side — manages the users_roles join table (user_id, role_id). */
  @ManyToMany(() => Role, (role) => role.users, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'users_roles',
    joinColumn: {
      name: 'user_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_users_roles_user_id',
    },
    inverseJoinColumn: {
      name: 'role_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_users_roles_role_id',
    },
  })
  roles: Role[];
}
