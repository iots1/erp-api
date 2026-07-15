import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateProductDTO } from './create-product.dto';

export class ProductResponseDTO extends IntersectionType(
  CreateProductDTO,
  BaseResponseDTO,
) {}
