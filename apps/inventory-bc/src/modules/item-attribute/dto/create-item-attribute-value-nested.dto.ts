import { OmitType } from '@nestjs/swagger';

import { CreateItemAttributeValueDTO } from './create-item-attribute-value.dto';

export class CreateItemAttributeValueNestedDTO extends OmitType(
  CreateItemAttributeValueDTO,
  ['attribute_id'] as const,
) {}
