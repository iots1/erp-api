import { ApiProperty } from '@nestjs/swagger';

export class LoginResultDTO {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  refresh_token: string;

  @ApiProperty({ example: 'Bearer' })
  token_type: 'Bearer';

  @ApiProperty({ description: 'Access token TTL in seconds', example: 900 })
  expires_in: number;
}
