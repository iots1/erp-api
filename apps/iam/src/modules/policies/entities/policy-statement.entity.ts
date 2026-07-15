import { Check, Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

export type StatementEffect = 'allow' | 'deny';
export type StatementPlane = 'ui' | 'api';

@Entity({
  name: 'policy_statements',
  database: ErpDatabases.IAM,
  comment:
    'กฎ 1 ข้อในนโยบาย (Effect + Plane) — เชื่อม targets/actions/conditions',
})
@Index('idx_policy_statements_policy_id', ['policy_id'])
@Check('chk_policy_statements_effect', `"effect" IN ('allow', 'deny')`)
@Check('chk_policy_statements_plane', `"plane" IN ('ui', 'api')`)
export class PolicyStatement extends BaseEntity {
  @Column({ type: 'uuid', comment: 'อ้างอิง policies.id' })
  policy_id: string;

  @Column({
    type: 'varchar',
    length: 10,
    comment: 'allow | deny — deny ชนะเสมอ',
  })
  effect: StatementEffect;

  @Column({ type: 'varchar', length: 10, comment: 'ui | api' })
  plane: StatementPlane;
}
