import { ApiProperty } from '@nestjs/swagger';

import { IsOptional, IsString, MaxLength } from 'class-validator';

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
  @ApiProperty({ description: 'ป้ายกำกับตัวแปร (อังกฤษ)', example: 'Customer name' })
  label_en: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    description: 'ค่าเริ่มต้นเมื่อไม่ได้ส่งค่ามาตอน render',
    example: 'บริษัท ตัวอย่าง จำกัด',
    nullable: true,
  })
  default_value: string | null;
}
