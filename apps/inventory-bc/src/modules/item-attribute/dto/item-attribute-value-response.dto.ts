import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateItemAttributeValueDTO } from './create-item-attribute-value.dto';

export class ItemAttributeValueResponseDTO extends IntersectionType(
  CreateItemAttributeValueDTO,
  BaseResponseDTO,
) {}
