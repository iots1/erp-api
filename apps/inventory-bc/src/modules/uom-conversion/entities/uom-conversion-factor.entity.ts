import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { NumericTransformer } from '@lib/common/transformers/numberic.transformer';

export enum UomConversionType {
  PURCHASE = 'purchase',
  SALES = 'sales',
}

/** Alternate-UOM conversion rate for a product (e.g. 1 กล่อง = 12 ชิ้น). */
@Entity({ name: 'uom_conversion_factors', database: ErpDatabases.INVENTORY })
@Index('idx_uom_conversion_factors_product_id', ['product_id'])
export class UomConversionFactor extends BaseEntity {
  @Column({ type: 'uuid', comment: 'สินค้าที่ใช้อัตรานี้ / Product ID' })
  product_id: string;

  @Column({
    type: 'uuid',
    comment: 'หน่วยทางเลือก (เช่น กล่อง) / Alternate UOM ID',
  })
  uom_id: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    comment:
      'เท่าของ stock_uom (เช่น 1 กล่อง = 12 ชิ้น → 12) / Conversion factor',
    transformer: new NumericTransformer(),
  })
  conversion_factor: number;

  @Column({
    type: 'enum',
    enum: UomConversionType,
    comment: 'purchase | sales',
  })
  uom_type: UomConversionType;
}
