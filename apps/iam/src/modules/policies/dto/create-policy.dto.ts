import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreatePolicyDTO {
  @IsString()
  @ApiProperty({
    description: 'รหัส policy',
    example: 'POL_WAREHOUSE_GOODS_RECEIPT',
  })
  code: string;

  @IsString()
  @ApiProperty({
    description: 'ชื่อ policy (ไทย)',
    example: 'คลังสินค้า · รับสินค้า',
  })
  name_th: string;

  @IsString()
  @ApiProperty({
    description: 'ชื่อ policy (English)',
    example: 'Warehouse · Goods Receipt',
  })
  name_en: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'เปิด/ปิดใช้งาน', example: true })
  is_active: boolean;
}
