import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateUserDTO } from './create-user.dto';

export class UserResponseDTO extends IntersectionType(
  CreateUserDTO,
  BaseResponseDTO,
) {}
