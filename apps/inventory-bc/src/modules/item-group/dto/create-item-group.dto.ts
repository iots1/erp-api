import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateItemGroupDTO {
  @IsString()
  @MaxLength(150)
  @ApiProperty({ description: 'ชื่อกลุ่ม (ไทย)', example: 'เครื่องเขียน' })
  name_th: string;

  @IsString()
  @MaxLength(150)
  @ApiProperty({ description: 'ชื่อกลุ่ม (อังกฤษ)', example: 'Stationery' })
  name_en: string;

  @IsBoolean()
  @ApiProperty({
    description: 'node (true) / leaf (false) — เฉพาะ leaf ที่ผูกสินค้าได้',
    example: false,
  })
  is_group: boolean;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    description: 'กลุ่มแม่ (null = root)',
    example: null,
  })
  parent_item_group_id: string | null;
}
