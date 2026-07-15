import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateItemAttributeDTO } from './create-item-attribute.dto';

export class ItemAttributeResponseDTO extends IntersectionType(
  CreateItemAttributeDTO,
  BaseResponseDTO,
) {}
