import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

@Entity({
  name: 'statement_actions',
  database: ErpDatabases.IAM,
  comment: 'การกระทำ (permission) ที่ statement นี้อนุญาต/ปฏิเสธ',
})
@Index('idx_statement_actions_statement_id', ['statement_id'])
@Index('idx_statement_actions_permission_id', ['permission_id'])
export class StatementAction extends BaseEntity {
  @Column({ type: 'uuid', comment: 'อ้างอิง policy_statements.id' })
  statement_id: string;

  @Column({ type: 'uuid', comment: 'อ้างอิง permissions.id' })
  permission_id: string;
}
