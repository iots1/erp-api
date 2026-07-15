import { Column, Entity } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

@Entity({
  name: 'roles',
  database: ErpDatabases.IAM,
  comment: 'บทบาท — ROLE_* ผูกกับ policies ผ่าน role_policies',
})
export class Role extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    comment: 'รหัสบทบาท เช่น ROLE_WAREHOUSE_MANAGER (unique) — uq_roles_code',
  })
  code: string;

  @Column({ type: 'varchar', length: 200, comment: 'ชื่อบทบาท (ไทย)' })
  name_th: string;

  @Column({ type: 'varchar', length: 200, comment: 'ชื่อบทบาท (English)' })
  name_en: string;

  @Column({ type: 'text', nullable: true, comment: 'คำอธิบาย' })
  description: string | null;
}
