import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateUomDTO } from './create-uom.dto';

export class UomResponseDTO extends IntersectionType(
  CreateUomDTO,
  BaseResponseDTO,
) {}
