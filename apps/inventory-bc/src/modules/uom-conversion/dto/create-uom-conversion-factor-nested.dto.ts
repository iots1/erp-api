import { OmitType } from '@nestjs/swagger';

import { CreateUomConversionFactorDTO } from './create-uom-conversion-factor.dto';

export class CreateUomConversionFactorNestedDTO extends OmitType(
  CreateUomConversionFactorDTO,
  ['product_id'] as const,
) {}
