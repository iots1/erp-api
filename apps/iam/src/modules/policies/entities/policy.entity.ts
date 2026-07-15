import { Column, Entity } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

@Entity({
  name: 'policies',
  database: ErpDatabases.IAM,
  comment: 'นโยบายสิทธิ์ (POL_*) — ประกอบด้วยหลาย statement',
})
export class Policy extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
    comment:
      'รหัส policy เช่น POL_WAREHOUSE_GOODS_RECEIPT (unique) — uq_policies_code',
  })
  code: string;

  @Column({ type: 'varchar', length: 200, comment: 'ชื่อ policy (ไทย)' })
  name_th: string;

  @Column({ type: 'varchar', length: 200, comment: 'ชื่อ policy (English)' })
  name_en: string;

  @Column({ type: 'boolean', default: true, comment: 'เปิด/ปิดใช้งาน' })
  is_active: boolean;
}
