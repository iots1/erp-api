import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

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

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description:
      'ใช้งานได้ตั้งแต่วันที่ (YYYY-MM-DD) — ไม่กรอก/null = ไม่จำกัด',
    example: '2026-01-01',
    nullable: true,
  })
  valid_from: string | null;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'ใช้งานได้ถึงวันที่ (YYYY-MM-DD) — ไม่กรอก/null = ไม่จำกัด',
    example: '2026-12-31',
    nullable: true,
  })
  valid_until: string | null;
}
