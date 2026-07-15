import { ApiProperty, IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateItemGroupDTO } from './create-item-group.dto';

export class ItemGroupResponseDTO extends IntersectionType(
  CreateItemGroupDTO,
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
