import { ApiProperty } from '@nestjs/swagger';

import { IsString } from 'class-validator';

export class LoginDTO {
  @IsString()
  @ApiProperty({ example: 'admin' })
  username: string;

  @IsString()
  @ApiProperty({ example: 'Admin@12345' })
  password: string;
}
