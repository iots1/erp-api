import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import {
  PRINT_TEMPLATE_ORIENTATIONS,
  PRINT_TEMPLATE_PAPER_SIZES,
} from '../constants/print-template.constants';
import { PrintTemplateParameterDTO } from './print-template-parameter.dto';

export class CreatePrintTemplateDTO {
  @IsString()
  @MaxLength(50)
  @ApiProperty({ description: 'รหัสเทมเพลต (unique)', example: 'invoice' })
  code: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({
    description: 'ชื่อเทมเพลต (ไทย)',
    example: 'ใบแจ้งหนี้มาตรฐาน',
  })
  name_th: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({
    description: 'ชื่อเทมเพลต (อังกฤษ)',
    example: 'Standard invoice',
  })
  name_en: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'คำอธิบายเทมเพลต (ไทย)',
    example: 'ใช้สำหรับพิมพ์ใบแจ้งหนี้ลูกค้าทั่วไป',
  })
  description_th: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'คำอธิบายเทมเพลต (อังกฤษ)',
    example: 'Used for standard customer invoices',
  })
  description_en: string | null;

  @IsString()
  @ApiProperty({
    description:
      'เนื้อหา HTML ที่จะส่งให้ Gotenberg แปลงเป็น PDF — เก็บไว้ใน object storage เท่านั้น ' +
      '(ไม่ได้ persist ที่คอลัมน์นี้ใน Postgres)',
    example: '<html><body><h1>Invoice</h1></body></html>',
  })
  html_content: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'สถานะใช้งาน', example: true })
  is_active: boolean;

  @IsOptional()
  @IsIn(PRINT_TEMPLATE_PAPER_SIZES)
  @ApiPropertyOptional({
    description: 'ขนาดกระดาษสำหรับ render PDF',
    enum: PRINT_TEMPLATE_PAPER_SIZES,
    example: 'A4',
  })
  paper_size: string;

  @IsOptional()
  @IsIn(PRINT_TEMPLATE_ORIENTATIONS)
  @ApiPropertyOptional({
    description: 'แนวกระดาษ',
    enum: PRINT_TEMPLATE_ORIENTATIONS,
    example: 'portrait',
  })
  orientation: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintTemplateParameterDTO)
  @ApiPropertyOptional({
    description: 'รายการตัวแปร {{key}} สำหรับแทนที่ใน html_content ตอน render',
    type: [PrintTemplateParameterDTO],
  })
  parameters: PrintTemplateParameterDTO[];
}
