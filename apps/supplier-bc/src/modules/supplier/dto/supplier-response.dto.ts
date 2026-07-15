import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateSupplierDTO } from './create-supplier.dto';

export class SupplierResponseDTO extends IntersectionType(
  CreateSupplierDTO,
  BaseResponseDTO,
) {}
