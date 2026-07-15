import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

@Entity({
  name: 'security_logs',
  database: ErpDatabases.AUTH,
  comment: 'audit เชิงความปลอดภัย (เปลี่ยนรหัส, สิทธิ์, login/logout, block)',
})
@Index('idx_security_logs_user_id', ['user_id'])
export class SecurityLog extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    comment:
      'ประเภทเหตุการณ์ เช่น login_success, login_failed, logout, password_set, account_blocked',
  })
  event_type: string;

  @Column({ type: 'uuid', nullable: true, comment: 'อ้างอิง iam.users.id' })
  user_id: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: 'IP address',
  })
  ip_address: string | null;

  @Column({ type: 'text', nullable: true, comment: 'รายละเอียดเพิ่มเติม' })
  detail: string | null;
}
