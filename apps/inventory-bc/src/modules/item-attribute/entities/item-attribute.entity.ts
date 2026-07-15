import { Column, Entity } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

/** Variant attribute definition (e.g. Color, Size) used to generate product variants. */
@Entity({ name: 'item_attributes', database: ErpDatabases.INVENTORY })
export class ItemAttribute extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    comment: 'ชื่อคุณลักษณะ เช่น สี, ขนาด / Attribute name',
  })
  name: string;
}
