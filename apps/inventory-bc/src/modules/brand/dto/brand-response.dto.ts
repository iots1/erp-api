import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateBrandDTO } from './create-brand.dto';

export class BrandResponseDTO extends IntersectionType(
  CreateBrandDTO,
  BaseResponseDTO,
) {}
