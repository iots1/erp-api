import { Column, Entity } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

/** Unit of measure master (ชิ้น / กล่อง / กก. / ลิตร) — referenced as `stock_uom` on products. */
@Entity({ name: 'uoms', database: ErpDatabases.INVENTORY })
export class Uom extends BaseEntity {
  @Column({ type: 'varchar', length: 100, comment: 'ชื่อหน่วยนับ / UOM name' })
  name: string;

  @Column({
    type: 'boolean',
    comment: 'หน่วยนับเป็นจำนวนเต็มเท่านั้นหรือไม่ / Whole-number-only unit',
  })
  is_whole_number: boolean;
}
