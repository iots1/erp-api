import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

/** ABAC operator applied when evaluating a statement condition at request time. */
export type ConditionOperator =
  | 'StringEquals'
  | 'StringLike'
  | 'NumericEquals'
  | 'NumericGreaterThan'
  | 'NumericLessThan'
  | 'DateGreaterThan'
  | 'DateLessThan'
  | 'IpAddress';

@Entity({
  name: 'statement_conditions',
  database: ErpDatabases.IAM,
  comment: 'เงื่อนไข ABAC (optional) — operator + key + value, จริงถึงจะมีผล',
})
@Index('idx_statement_conditions_statement_id', ['statement_id'])
export class StatementCondition extends BaseEntity {
  @Column({ type: 'uuid', comment: 'อ้างอิง policy_statements.id' })
  statement_id: string;

  @Column({
    type: 'varchar',
    length: 50,
    comment: 'StringEquals/StringLike/Numeric*/Date*/IpAddress',
  })
  operator: ConditionOperator;

  @Column({
    type: 'varchar',
    length: 150,
    comment: 'คีย์ที่ประเมิน เช่น customer.owner_id, context.current_time',
  })
  condition_key: string;

  @Column({
    type: 'varchar',
    length: 300,
    comment: 'ค่าที่ใช้เปรียบเทียบ รองรับ ${user.id} placeholder',
  })
  condition_value: string;
}
