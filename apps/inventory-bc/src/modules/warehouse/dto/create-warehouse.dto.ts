import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { WarehouseType } from '../entities/warehouse.entity';

export class CreateWarehouseDTO {
  @IsString()
  @MaxLength(150)
  @ApiProperty({ description: 'ชื่อคลัง (ไทย)', example: 'คลังสินค้าหลัก' })
  name_th: string;

  @IsString()
  @MaxLength(150)
  @ApiProperty({ description: 'ชื่อคลัง (อังกฤษ)', example: 'Main Warehouse' })
  name_en: string;

  @IsEnum(WarehouseType)
  @ApiProperty({
    description: 'stock | transit | reject',
    enum: WarehouseType,
    example: WarehouseType.STOCK,
  })
  warehouse_type: WarehouseType;

  @IsBoolean()
  @ApiProperty({
    description: 'node/leaf — เฉพาะ leaf ที่เก็บสต็อก/รับสินค้าได้',
    example: false,
  })
  is_group: boolean;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ description: 'คลังแม่ (null = root)', example: null })
  parent_warehouse_id: string | null;
}
