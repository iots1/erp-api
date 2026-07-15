import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

@Entity({
  name: 'credentials',
  database: ErpDatabases.AUTH,
  comment:
    'เก็บรหัสผ่าน (hash) แยกจากข้อมูลผู้ใช้ — user_id อ้างอิง iam.users ด้วย UUID',
})
@Index('idx_credentials_user_id', ['user_id'])
export class Credential extends BaseEntity {
  @Column({ type: 'uuid', comment: 'อ้างอิง iam.users.id (ข้าม BC ด้วย UUID)' })
  user_id: string;

  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    comment:
      'ชื่อผู้ใช้ (สำเนาจาก iam เพื่อ lookup เร็ว) — uq_credentials_username',
  })
  username: string;

  @Column({ type: 'varchar', length: 200, comment: 'รหัสผ่าน (bcrypt hash)' })
  password_hash: string;

  @Column({
    type: 'boolean',
    default: true,
    comment: 'สถานะใช้งาน credential นี้',
  })
  is_active: boolean;
}
