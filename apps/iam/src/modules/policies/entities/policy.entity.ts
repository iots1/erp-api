import { Column, Entity, Index, ManyToMany, OneToMany } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

import { Role } from '../../roles/entities/role.entity';
import { PolicyStatement } from './policy-statement.entity';

@Entity({
  name: 'policies',
  database: ErpDatabases.IAM,
  comment: 'นโยบายสิทธิ์ (POL_*) — ประกอบด้วยหลาย statement',
})
/**
 * Partial unique index instead of a plain column constraint — `code` must be
 * unique only among *live* rows, so a soft-deleted policy's code can be
 * reused by a new one (a plain UNIQUE constraint would collide with the
 * soft-deleted row forever, since delete() never touches `code`).
 */
@Index('uq_policies_code', ['code'], { unique: true, where: 'is_deleted = false' })
export class Policy extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    comment:
      'รหัส policy เช่น POL_WAREHOUSE_GOODS_RECEIPT (unique เฉพาะแถวที่ยังไม่ถูกลบ) — uq_policies_code',
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
