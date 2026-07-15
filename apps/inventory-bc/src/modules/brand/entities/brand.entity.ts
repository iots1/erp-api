import { Column, Entity } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

/** Brand master (ยี่ห้อ) — optionally referenced by products. */
@Entity({ name: 'brands', database: ErpDatabases.INVENTORY })
export class Brand extends BaseEntity {
  @Column({ type: 'varchar', length: 150, comment: 'ชื่อยี่ห้อ / Brand name' })
  name: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'โลโก้ (อัปโหลดผ่าน storage → presigned URL) / Logo URL',
  })
  logo_url: string | null;
}
