import { Column, Entity, Index, Unique } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

@Entity({
  name: 'user_roles',
  database: ErpDatabases.IAM,
  comment: 'ผู้ใช้ ↔ บทบาท (ผู้ใช้ 1 คนมีได้หลาย role)',
})
@Index('idx_user_roles_user_id', ['user_id'])
@Unique('uq_user_roles_user_id_role_id', ['user_id', 'role_id'])
export class UserRole extends BaseEntity {
  @Column({ type: 'uuid', comment: 'อ้างอิง users.id' })
  user_id: string;

  @Column({ type: 'uuid', comment: 'อ้างอิง roles.id' })
  role_id: string;
}
