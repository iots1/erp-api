import { PartialType } from '@nestjs/swagger';

import { CreateReorderLevelDTO } from './create-reorder-level.dto';

export class UpdateReorderLevelDTO extends PartialType(CreateReorderLevelDTO) {}
