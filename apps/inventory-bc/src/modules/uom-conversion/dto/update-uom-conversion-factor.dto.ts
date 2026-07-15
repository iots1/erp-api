import { PartialType } from '@nestjs/swagger';

import { CreateUomConversionFactorDTO } from './create-uom-conversion-factor.dto';

export class UpdateUomConversionFactorDTO extends PartialType(
  CreateUomConversionFactorDTO,
) {}
