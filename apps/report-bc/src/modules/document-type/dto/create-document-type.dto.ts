import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateDocumentTypeDTO {
  @IsString()
  @MaxLength(50)
  @ApiProperty({ description: 'รหัสประเภทเอกสาร (unique)', example: 'invoice' })
  code: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({ description: 'ชื่อประเภทเอกสาร (ไทย)', example: 'ใบแจ้งหนี้' })
  name_th: string;

  @IsString()
  @MaxLength(255)
  @ApiProperty({ description: 'ชื่อประเภทเอกสาร (อังกฤษ)', example: 'Invoice' })
  name_en: string;

  @IsUUID()
  @ApiProperty({
    description: 'ID ของ print template ที่ใช้ render เอกสารประเภทนี้',
    example: '6007fe4d-4eb5-42d2-b4e7-b8205c110c5a',
  })
  print_template_id: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'มีเลขที่รันอัตโนมัติหรือไม่', example: true })
  has_running_number: boolean;

  // Required only when has_running_number is true — enforced here rather
  // than at the column level (nullable) since a document type without a
  // running number legitimately has no format at all.
  @ValidateIf((o: CreateDocumentTypeDTO) => o.has_running_number === true)
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional({
    description:
      'รูปแบบเลขที่เอกสาร ใช้ {YYYY}/{YY}/{MM}/{DD}/{SEQ:n} — ต้องมี {SEQ:n} เพียงครั้งเดียว บังคับเมื่อ has_running_number = true',
    example: 'INV-{YYYY}{MM}-{SEQ:5}',
    nullable: true,
  })
  running_number_format: string | null;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'สถานะใช้งาน', example: true })
  is_active: boolean;
}
