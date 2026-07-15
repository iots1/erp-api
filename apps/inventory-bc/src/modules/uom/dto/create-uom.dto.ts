import { ApiProperty } from '@nestjs/swagger';

import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class CreateUomDTO {
  @IsString()
  @MaxLength(100)
  @ApiProperty({ description: 'ชื่อหน่วยนับ', example: 'ชิ้น' })
  name: string;

  @IsBoolean()
  @ApiProperty({
    description: 'หน่วยนับเป็นจำนวนเต็มเท่านั้นหรือไม่',
    example: true,
  })
  is_whole_number: boolean;
}
