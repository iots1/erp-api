import { ApiProperty, IntersectionType } from '@nestjs/swagger';

import { Transform } from 'class-transformer';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';
import { NumericTransformer } from '@lib/common/transformers/numberic.transformer';

import { CreateUomConversionFactorDTO } from './create-uom-conversion-factor.dto';

export class UomConversionFactorResponseDTO extends IntersectionType(
  CreateUomConversionFactorDTO,
  BaseResponseDTO,
) {
  @Transform(NumericTransformer.toDTO)
  @ApiProperty({ description: 'เท่าของ stock_uom', example: 12 })
  declare conversion_factor: number;
}
