import { ApiProperty } from '@nestjs/swagger';

import { IsString, MaxLength } from 'class-validator';

export class CreateItemAttributeDTO {
  @IsString()
  @MaxLength(100)
  @ApiProperty({ description: 'ชื่อคุณลักษณะ เช่น สี, ขนาด', example: 'สี' })
  name: string;
}
