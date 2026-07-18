import { ApiProperty } from '@nestjs/swagger';

export class LoginHistoryResponseDTO {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  user_id: string | null;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true })
  ip_address: string | null;

  @ApiProperty({ nullable: true })
  user_agent: string | null;

  @ApiProperty()
  is_success: boolean;

  @ApiProperty()
  logged_in_at: Date;
}
