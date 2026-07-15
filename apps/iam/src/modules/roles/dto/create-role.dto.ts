import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString } from 'class-validator';

export class CreateRoleDTO {
  @IsString()
  @ApiProperty({ description: 'รหัสบทบาท', example: 'ROLE_WAREHOUSE_MANAGER' })
  code: string;

  @IsString()
  @ApiProperty({
    description: 'ชื่อบทบาท (ไทย)',
    example: 'ผู้จัดการคลังสินค้า',
  })
  name_th: string;

  @IsString()
  @ApiProperty({
    description: 'ชื่อบทบาท (English)',
    example: 'Warehouse Manager',
  })
  name_en: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'คำอธิบาย', nullable: true })
  description: string | null;
}
