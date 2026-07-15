import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSupplierDTO {
  @IsString()
  @MaxLength(50)
  @ApiProperty({ description: 'รหัสผู้จัดซื้อ (unique)', example: 'SUP-0001' })
  code: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({
    description: 'ชื่อผู้จัดซื้อ (ไทย)',
    example: 'บริษัท ตัวอย่าง จำกัด',
  })
  name_th: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({
    description: 'ชื่อผู้จัดซื้อ (อังกฤษ)',
    example: 'Example Co., Ltd.',
  })
  name_en: string;

  @IsString()
  @MaxLength(20)
  @ApiProperty({
    description: 'เลขประจำตัวผู้เสียภาษี',
    example: '0105558000001',
  })
  tax_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @ApiPropertyOptional({
    description: 'เบอร์โทรติดต่อ',
    example: '02-123-4567',
  })
  contact_phone: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'ที่อยู่',
    example: '123 ถนนตัวอย่าง กรุงเทพฯ',
  })
  address: string | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ description: 'เงื่อนไขเครดิต (วัน)', example: 30 })
  credit_terms: number | null;
}
