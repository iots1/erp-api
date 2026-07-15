import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateReorderLevelDTO } from './create-reorder-level.dto';

export class ReorderLevelResponseDTO extends IntersectionType(
  CreateReorderLevelDTO,
  BaseResponseDTO,
) {}
