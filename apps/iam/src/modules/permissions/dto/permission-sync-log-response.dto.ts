import { ApiProperty } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import type { IPermissionSyncEntry } from '../entities/permission-sync-log.entity';

export class PermissionSyncLogResponseDTO extends BaseResponseDTO {
  @ApiProperty({
    example: [{ service: 'inventory-bc', permission: 'brand:create' }],
    description: 'Permission ที่เพิ่มใหม่รอบนี้',
  })
  added: IPermissionSyncEntry[];

  @ApiProperty({
    example: [],
    description: 'Permission ที่หายไปรอบนี้ (soft-deleted ไม่ถูกลบจริง)',
  })
  removed: IPermissionSyncEntry[];

  @ApiProperty({ example: 3 })
  added_count: number;

  @ApiProperty({ example: 0 })
  removed_count: number;

  @ApiProperty({ example: 128 })
  unchanged_count: number;

  @ApiProperty({
    example: 'iam-admin-web',
    nullable: true,
    description: 'ผู้/สิ่งที่รัน sync เช่น hostname หรือ username จากปุ่ม Sync',
  })
  triggered_by: string | null;
}
