import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';

export class VariantAttributeSelectionDTO {
  @IsUUID()
  @ApiProperty({
    description: 'Attribute ID (เช่น สี)',
    example: 'a1b2c3d4-...',
  })
  attribute_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  @ApiProperty({
    description: 'ค่าที่เลือกสำหรับ attribute นี้ (อย่างน้อย 1 ค่า)',
    example: ['b2c3d4e5-...', 'c3d4e5f6-...'],
    type: [String],
  })
  value_ids: string[];
}

export class GenerateVariantsDTO {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantAttributeSelectionDTO)
  @ApiProperty({
    description:
      'ชุด attribute × ค่าที่เลือก ใช้ cartesian-product สร้าง variant',
    type: [VariantAttributeSelectionDTO],
  })
  attributes: VariantAttributeSelectionDTO[];
}
