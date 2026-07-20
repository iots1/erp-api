import { Column, Entity, ManyToMany, OneToMany } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { Role } from '../../roles/entities/role.entity';
import { PolicyStatement } from './policy-statement.entity';

@Entity({
  name: 'policies',
  database: ErpDatabases.IAM,
  comment: 'นโยบายสิทธิ์ (POL_*) — ประกอบด้วยหลาย statement',
})
export class Policy extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    comment:
      'รหัส policy เช่น POL_WAREHOUSE_GOODS_RECEIPT (unique) — uq_policies_code',
  })
  code: string;

  @Column({ type: 'varchar', length: 200, comment: 'ชื่อ policy (ไทย)' })
  name_th: string;

  @Column({ type: 'varchar', length: 200, comment: 'ชื่อ policy (English)' })
  name_en: string;

  @Column({ type: 'boolean', default: true, comment: 'เปิด/ปิดใช้งาน' })
  is_active: boolean;

  @OneToMany(() => PolicyStatement, (statement) => statement.policy)
  statements: PolicyStatement[];

  /**
   * Inverse side — owning side (JoinTable) lives on Role.policies. TypeORM
   * takes the inverse FK's (roles_policies.policy_id) ON DELETE behavior from
   * *this* side's `onDelete`, not the owning side's — must be set here too.
   */
  @ManyToMany(() => Role, (role) => role.policies, { onDelete: 'CASCADE' })
  roles: Role[];
}
