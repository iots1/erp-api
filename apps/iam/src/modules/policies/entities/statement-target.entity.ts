import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

@Entity({
  name: 'statement_targets',
  database: ErpDatabases.IAM,
  comment: 'service + resource ที่ statement มีผล (resource: "*" = ทั้งหมด)',
})
@Index('idx_statement_targets_statement_id', ['statement_id'])
export class StatementTarget extends BaseEntity {
  @Column({ type: 'uuid', comment: 'อ้างอิง policy_statements.id' })
  statement_id: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'ระบบ/บริการเป้าหมาย เช่น frontend-ui, inventory-bc',
  })
  service: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'ทรัพยากรที่ถูกเข้าถึง หรือ * = ทั้งหมด',
  })
  resource: string;
}
