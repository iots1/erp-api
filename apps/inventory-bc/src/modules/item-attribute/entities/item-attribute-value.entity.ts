import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '@lib/common/abstracts/base-entity.abstract';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';

/** A selectable value of an {@link ItemAttribute} (e.g. แดง, น้ำเงิน, S, M, L). */
@Entity({ name: 'item_attribute_values', database: ErpDatabases.INVENTORY })
@Index('idx_item_attribute_values_attribute_id', ['attribute_id'])
export class ItemAttributeValue extends BaseEntity {
  @Column({
    type: 'uuid',
    comment: 'อ้างถึง attribute แม่ / Parent attribute ID',
  })
  attribute_id: string;

  @Column({
    type: 'varchar',
    length: 100,
    comment: 'ค่า เช่น แดง, น้ำเงิน, S, M, L / Value',
  })
  value: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    comment: 'ตัวย่อ (ใช้ประกอบ SKU ของ variant) / Abbreviation',
  })
  abbr: string | null;
}
