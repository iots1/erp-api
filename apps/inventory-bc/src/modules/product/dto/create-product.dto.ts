import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { ProductType } from '../entities/product.entity';

export class CreateProductDTO {
  @IsString()
  @MaxLength(100)
  @ApiProperty({ description: 'รหัสสินค้า (unique)', example: 'PEN-UNI-BL-05' })
  sku: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({
    description: 'ชื่อสินค้า (ไทย)',
    example: 'ปากกาเจล UNI น้ำเงิน 0.5',
  })
  name_th: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({
    description: 'ชื่อสินค้า (อังกฤษ)',
    example: 'UNI Gel Pen Blue 0.5',
  })
  name_en: string;

  @IsEnum(ProductType)
  @ApiProperty({
    description: 'single | bundle',
    enum: ProductType,
    example: ProductType.SINGLE,
  })
  type: ProductType;

  @IsUUID()
  @ApiProperty({ description: 'กลุ่มสินค้า (leaf)', example: 'a1b2c3d4-...' })
  item_group_id: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ description: 'ยี่ห้อ', example: null })
  brand_id: string | null;

  @IsUUID()
  @ApiProperty({ description: 'หน่วยเก็บสต็อกหลัก', example: 'a1b2c3d4-...' })
  stock_uom_id: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'true = สินค้าต้นแบบ (template) ห้ามทำธุรกรรมตรง',
    example: false,
    default: false,
  })
  has_variants: boolean;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'ถ้าเป็น variant → อ้าง product ต้นแบบ',
    example: null,
  })
  template_product_id: string | null;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'ผู้จัดซื้อหลัก (ref supplier-bc · UUID)',
    example: null,
  })
  supplier_id: string | null;
}
