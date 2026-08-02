import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import {
  PRINT_TEMPLATE_ENGINES,
  PRINT_TEMPLATE_MEDIA_TYPES,
  PRINT_TEMPLATE_ORIENTATIONS,
  PRINT_TEMPLATE_PAPER_SIZES,
} from '../constants/print-template.constants';
import { PrintTemplateLayoutConfigDTO } from './print-template-layout-config.dto';
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
  @IsString()
  @ApiPropertyOptional({
    description:
      "สคริปต์ paginator เฉพาะของเทมเพลตนี้ (มีผลเฉพาะ template_engine='banded') — ถ้าระบุ จะใช้แทน " +
      'assets/paginator.inline.js กลาง สำหรับเอกสารที่ต้องการกฎการตัดขึ้นหน้าใหม่ไม่เหมือนเอกสารอื่น ' +
      'เก็บไว้ใน object storage เท่านั้นเช่นเดียวกับ html_content — null/ไม่ระบุ = ใช้ paginator กลาง',
    example: null,
  })
  js_content?: string | null;

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

  @IsOptional()
  @IsIn(PRINT_TEMPLATE_ENGINES)
  @ApiPropertyOptional({
    description:
      "เอนจินสร้าง PDF — 'simple' (ค่าเริ่มต้น) แทนที่ {{key}} ตรงๆ ไม่มีการแบ่งหน้า, 'banded' แบ่งหน้าอัตโนมัติจาก band template",
    enum: PRINT_TEMPLATE_ENGINES,
    example: 'simple',
  })
  template_engine?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PrintTemplateLayoutConfigDTO)
  @ApiPropertyOptional({
    description: "ค่าตั้งค่าเลย์เอาต์ — มีผลเฉพาะ template_engine='banded'",
    type: PrintTemplateLayoutConfigDTO,
  })
  layout_config?: PrintTemplateLayoutConfigDTO;

  @IsOptional()
  @IsIn(PRINT_TEMPLATE_MEDIA_TYPES)
  @ApiPropertyOptional({
    description:
      "CSS media type ที่ Gotenberg ใช้ตอน render — ปกติใช้ 'print' (ค่าเริ่มต้น จำเป็นสำหรับ thead/tfoot ซ้ำทุกหน้า)",
    enum: PRINT_TEMPLATE_MEDIA_TYPES,
    example: 'print',
  })
  emulated_media_type?: string;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description:
      "ตัวอย่างข้อมูลสำหรับ preview/Generate Test PDF ในหน้า admin เท่านั้น — 'simple' ใช้ {key: string} แบบแบน, 'banded' ใช้โครงสร้างซ้อน object/array ตามที่ band template ต้องการ ไม่เกี่ยวกับ params ที่ผู้เรียก render() จริงส่งมา",
    example: { customer_name: 'บริษัท เอบีซี จำกัด' },
  })
  mock_data?: Record<string, unknown>;
}
