import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { PRINT_TEMPLATE_PARAMETER_TYPES } from '../constants/print-template.constants';

/**
 * One field of a `type: 'array'` parameter's items — mirrors
 * `IPrintTemplateParameterField` (entities/print-template.entity.ts).
 */
export class PrintTemplateParameterFieldDTO {
  @IsString()
  @MaxLength(50)
  @ApiProperty({
    description: 'ชื่อ field ใช้เป็น {{row.key}} ใน band template',
    example: 'description',
  })
  key: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({ description: 'ป้ายกำกับ (ไทย)', example: 'รายละเอียด' })
  label_th: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({ description: 'ป้ายกำกับ (อังกฤษ)', example: 'Description' })
  label_en: string;

  @IsIn(PRINT_TEMPLATE_PARAMETER_TYPES)
  @ApiProperty({
    description: 'ชนิดข้อมูลของ field นี้',
    enum: PRINT_TEMPLATE_PARAMETER_TYPES,
    example: 'string',
  })
  type: string;
}

/**
 * Mirrors `IPrintTemplateParameter` (entities/print-template.entity.ts) with
 * validators. `key` is the `{{key}}` placeholder name substituted at render
 * time — see `PrintTemplatesService.render()`.
 */
export class PrintTemplateParameterDTO {
  @IsString()
  @MaxLength(50)
  @ApiProperty({
    description: 'ชื่อตัวแปร ใช้เป็น {{key}} ใน html_content',
    example: 'customer_name',
  })
  key: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({ description: 'ป้ายกำกับตัวแปร (ไทย)', example: 'ชื่อลูกค้า' })
  label_th: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({
    description: 'ป้ายกำกับตัวแปร (อังกฤษ)',
    example: 'Customer name',
  })
  label_en: string;

  @IsOptional()
  @IsIn(PRINT_TEMPLATE_PARAMETER_TYPES)
  @ApiPropertyOptional({
    description:
      "ชนิดข้อมูลของตัวแปร — 'array' ใช้กับ band ที่มี <template data-repeat=\"key\">, ไม่ระบุ = 'string'",
    enum: PRINT_TEMPLATE_PARAMETER_TYPES,
    example: 'string',
  })
  type?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'ค่าเริ่มต้นเมื่อไม่ได้ส่งค่ามาตอน render',
    example: 'บริษัท ตัวอย่าง จำกัด',
    nullable: true,
  })
  default_value: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintTemplateParameterFieldDTO)
  @ApiPropertyOptional({
    description: "เฉพาะ type='array' — โครงสร้างแต่ละ field ของ item ในลิสต์",
    type: [PrintTemplateParameterFieldDTO],
  })
  item_schema?: PrintTemplateParameterFieldDTO[];
}
