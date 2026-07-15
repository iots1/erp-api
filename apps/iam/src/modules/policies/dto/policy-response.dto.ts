import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreatePolicyDTO } from './create-policy.dto';

export class PolicyResponseDTO extends IntersectionType(
  CreatePolicyDTO,
  BaseResponseDTO,
) {}
