import { PartialType } from '@nestjs/swagger';

import { CreateItemAttributeValueDTO } from './create-item-attribute-value.dto';

export class UpdateItemAttributeValueDTO extends PartialType(
  CreateItemAttributeValueDTO,
) {}
