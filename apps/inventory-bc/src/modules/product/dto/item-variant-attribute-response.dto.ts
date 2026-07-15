import { ApiProperty } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

export class ItemVariantAttributeResponseDTO extends BaseResponseDTO {
  @ApiProperty({ description: 'Variant product ID', example: 'a1b2c3d4-...' })
  variant_product_id: string;

  @ApiProperty({ description: 'Attribute ID', example: 'b2c3d4e5-...' })
  attribute_id: string;

  @ApiProperty({ description: 'Attribute value ID', example: 'c3d4e5f6-...' })
  attribute_value_id: string;
}
