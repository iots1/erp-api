import { OmitType } from '@nestjs/swagger';

import { CreateReorderLevelDTO } from './create-reorder-level.dto';

export class CreateReorderLevelNestedDTO extends OmitType(
  CreateReorderLevelDTO,
  ['product_id'] as const,
) {}
