import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDTO {
  @ApiProperty({ description: 'JWT jti — also the Redis session key suffix' })
  jti: string;

  @ApiProperty()
  user_id: string;

  @ApiProperty({ nullable: true })
  username: string | null;

  @ApiProperty({ description: 'Seconds remaining before the access token expires' })
  ttl_seconds: number;

  @ApiProperty()
  expires_at: Date;
}
