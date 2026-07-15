import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateBrandDTO {
  @IsString()
  @MaxLength(150)
  @ApiProperty({ description: 'ชื่อยี่ห้อ', example: 'UNI' })
  name: string;

  @IsOptional()
  @IsUrl()
  @ApiPropertyOptional({
    description: 'โลโก้ (URL จาก storage)',
    example: 'https://storage.example.com/brands/uni-logo.png',
  })
  logo_url: string | null;
}
