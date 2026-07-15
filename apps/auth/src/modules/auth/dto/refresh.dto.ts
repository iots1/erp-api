import { ApiProperty } from '@nestjs/swagger';

import { IsString } from 'class-validator';

export class RefreshDTO {
  @IsString()
  @ApiProperty({ description: 'Refresh token issued at login' })
  refresh_token: string;
}
