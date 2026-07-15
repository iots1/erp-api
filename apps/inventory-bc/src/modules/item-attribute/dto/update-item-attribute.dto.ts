import { PartialType } from '@nestjs/swagger';

import { CreateItemAttributeDTO } from './create-item-attribute.dto';

export class UpdateItemAttributeDTO extends PartialType(
  CreateItemAttributeDTO,
) {}
