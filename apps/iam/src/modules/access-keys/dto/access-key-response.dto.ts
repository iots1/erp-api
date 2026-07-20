import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { AccessKeyStatus } from '../enums/access-key-status.enum';

/**
 * Swagger shape for read/list endpoints — deliberately omits `secret_key_encrypted`
 * (the entity column is `select: false`, so it never lands in the response anyway).
 */
export class AccessKeyResponseDTO extends BaseResponseDTO {
  @ApiProperty()
  access_key_id: string;

  @ApiProperty()
  owner_id: string;

  @ApiProperty({ enum: ['user', 'service_account'] })
  owner_type: 'user' | 'service_account';

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: AccessKeyStatus })
  status: AccessKeyStatus;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  last_used_at: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  expires_at: string | null;

  @ApiPropertyOptional({ nullable: true })
  metadata: Record<string, unknown> | null;
}
