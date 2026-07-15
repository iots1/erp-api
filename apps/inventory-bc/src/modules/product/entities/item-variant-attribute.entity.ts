import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

/**
 * Links a generated variant `Product` to the attribute value(s) that
 * distinguish it (e.g. เสื้อยืด-แดง-M → {สี: แดง, ขนาด: M}). Populated by
 * `ProductsService.generateVariants`.
 */
@Entity({ name: 'item_variant_attributes', database: ErpDatabases.INVENTORY })
@Index('idx_item_variant_attributes_variant_product_id', ['variant_product_id'])
export class ItemVariantAttribute extends BaseEntity {
  @Column({
    type: 'uuid',
    comment: 'variant ที่ทำธุรกรรมได้จริง / Variant product ID',
  })
  variant_product_id: string;

  @Column({ type: 'uuid', comment: 'อ้างถึง attribute / Attribute ID' })
  attribute_id: string;

  @Column({
    type: 'uuid',
    comment: 'อ้างถึงค่า attribute / Attribute value ID',
  })
  attribute_value_id: string;
}
