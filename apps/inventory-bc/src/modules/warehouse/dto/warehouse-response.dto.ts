import { ApiProperty, IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateWarehouseDTO } from './create-warehouse.dto';

export class WarehouseResponseDTO extends IntersectionType(
  CreateWarehouseDTO,
  BaseResponseDTO,
) {
  @ApiProperty({
    description: 'nested-set left bound (คำนวณโดยระบบ)',
    example: 1,
  })
  lft: number;

  @ApiProperty({
    description: 'nested-set right bound (คำนวณโดยระบบ)',
    example: 2,
  })
  rgt: number;
}
