import { ApiProperty } from '@nestjs/swagger';

import { ITimestamp } from '@lib/common/interfaces/timestamp.interface';

/**
 * Audit fields exposed on every resource response. Extend in feature response DTOs.
 */
export class BaseResponseDTO implements ITimestamp {
  @ApiProperty({ example: '2026-06-24T06:33:44.970Z', format: 'date-time' })
  created_at: Date;

  @ApiProperty({ example: null, format: 'uuid', nullable: true })
  created_by: string | null;

  @ApiProperty({ example: '2026-06-24T06:33:44.970Z', format: 'date-time' })
  updated_at: Date;

  @ApiProperty({ example: null, format: 'uuid', nullable: true })
  updated_by: string | null;

  @ApiProperty({ example: false, default: false })
  is_deleted: boolean;

  @ApiProperty({ example: null, nullable: true })
  deleted_reason: string | null;

  @ApiProperty({ example: null, format: 'date-time', nullable: true })
  deleted_at: Date | null;

  @ApiProperty({ example: null, format: 'uuid', nullable: true })
  deleted_by: string | null;
}
