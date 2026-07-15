import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

@Entity({
  name: 'blocked_users',
  database: ErpDatabases.AUTH,
  comment: 'ล็อกบัญชี (เช่น ใส่รหัสผิดเกินกำหนด)',
})
@Index('idx_blocked_users_user_id', ['user_id'])
export class BlockedUser extends BaseEntity {
  @Column({ type: 'uuid', comment: 'อ้างอิง iam.users.id' })
  user_id: string;

  @Column({ type: 'varchar', length: 200, comment: 'เหตุผลที่บล็อก' })
  reason: string;

  @Column({
    type: 'timestamptz',
    nullable: true,
    comment: 'บล็อกจนถึงเมื่อไร (null = ไม่มีกำหนด)',
  })
  blocked_until: Date | null;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'ผู้ที่ทำการบล็อก (null = ระบบ auto-lock)',
  })
  blocked_by: string | null;
}
