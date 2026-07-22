import { ApiProperty } from '@nestjs/swagger';

export class LoginResultDTO {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  refresh_token: string;

  @ApiProperty({
    description:
      'Double-submit CSRF token. Also set as a non-httpOnly cookie; browser clients must echo it back as the `x-csrf-token` header on mutating requests.',
  })
  csrf_token: string;

  @ApiProperty({ example: 'Bearer' })
  token_type: 'Bearer';

  @ApiProperty({ description: 'Access token TTL in seconds', example: 900 })
  expires_in: number;
}
