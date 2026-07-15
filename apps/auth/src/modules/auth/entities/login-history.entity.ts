import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

@Entity({
  name: 'login_histories',
  database: ErpDatabases.AUTH,
  comment: 'ประวัติเข้าใช้งาน (สำเร็จ/ล้มเหลว)',
})
@Index('idx_login_histories_user_id', ['user_id'])
export class LoginHistory extends BaseEntity {
  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'อ้างอิง iam.users.id (null ถ้า username ไม่พบ)',
  })
  user_id: string | null;

  @Column({ type: 'varchar', length: 100, comment: 'username ที่ใช้ล็อกอิน' })
  username: string;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: 'IP address',
  })
  ip_address: string | null;

  @Column({
    type: 'varchar',
    length: 300,
    nullable: true,
    comment: 'User agent',
  })
  user_agent: string | null;

  @Column({ type: 'boolean', comment: 'สำเร็จหรือไม่' })
  is_success: boolean;

  @Column({ type: 'timestamptz', comment: 'เวลาที่เข้าใช้งาน' })
  logged_in_at: Date;
}
