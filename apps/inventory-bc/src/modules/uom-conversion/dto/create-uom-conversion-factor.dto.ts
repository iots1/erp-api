import { ApiProperty } from '@nestjs/swagger';

import { IsEnum, IsNumber, IsUUID, Min } from 'class-validator';

import { UomConversionType } from '../entities/uom-conversion-factor.entity';

export class CreateUomConversionFactorDTO {
  @IsUUID()
  @ApiProperty({ description: 'สินค้าที่ใช้อัตรานี้', example: 'a1b2c3d4-...' })
  product_id: string;

  @IsUUID()
  @ApiProperty({
    description: 'หน่วยทางเลือก (เช่น กล่อง)',
    example: 'b2c3d4e5-...',
  })
  uom_id: string;

  @IsNumber()
  @Min(0.0001)
  @ApiProperty({
    description: 'เท่าของ stock_uom (เช่น 1 กล่อง = 12 ชิ้น → 12)',
    example: 12,
  })
  conversion_factor: number;

  @IsEnum(UomConversionType)
  @ApiProperty({
    description: 'purchase | sales',
    enum: UomConversionType,
    example: UomConversionType.PURCHASE,
  })
  uom_type: UomConversionType;
}
