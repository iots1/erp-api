import { ApiProperty } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import type { PermissionPlane } from '../entities/permission.entity';

export class PermissionResponseDTO extends BaseResponseDTO {
  @ApiProperty({
    example: 'inventory-bc',
    description: 'BC ที่ประกาศสิทธิ์นี้',
  })
  service: string;

  @ApiProperty({ example: 'goods_receipt:submit' })
  permission: string;

  @ApiProperty({ example: 'goods_receipt' })
  resource: string;

  @ApiProperty({ example: 'submit' })
  action: string;

  @ApiProperty({ example: 'api' })
  plane: PermissionPlane;

  @ApiProperty({ example: 'ยืนยันรับสินค้า' })
  permission_name_th: string;

  @ApiProperty({ example: 'Submit goods receipt' })
  permission_name_en: string;

  @ApiProperty({
    example: false,
    description:
      'true = added manually via the Permissions page · false = synced from code (permissions:sync) — only manual rows can be deleted',
  })
  is_manual: boolean;
}
