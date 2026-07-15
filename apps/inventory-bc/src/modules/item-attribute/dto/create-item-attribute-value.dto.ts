import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateItemAttributeValueDTO {
  @IsUUID()
  @ApiProperty({
    description: 'อ้างถึง attribute แม่',
    example: 'a1b2c3d4-...',
  })
  attribute_id: string;

  @IsString()
  @MaxLength(100)
  @ApiProperty({
    description: 'ค่า เช่น แดง, น้ำเงิน, S, M, L',
    example: 'แดง',
  })
  value: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @ApiPropertyOptional({
    description: 'ตัวย่อ (ใช้ประกอบ SKU ของ variant)',
    example: 'R',
  })
  abbr: string | null;
}
