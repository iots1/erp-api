import { Column, Entity, Index, Unique } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

@Entity({
  name: 'role_policies',
  database: ErpDatabases.IAM,
  comment: 'บทบาท ↔ นโยบาย (attach policy เข้า role)',
})
@Index('idx_role_policies_role_id', ['role_id'])
@Unique('uq_role_policies_role_id_policy_id', ['role_id', 'policy_id'])
export class RolePolicy extends BaseEntity {
  @Column({ type: 'uuid', comment: 'อ้างอิง roles.id' })
  role_id: string;

  @Column({ type: 'uuid', comment: 'อ้างอิง policies.id' })
  policy_id: string;
}
