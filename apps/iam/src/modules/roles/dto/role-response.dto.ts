import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateRoleDTO } from './create-role.dto';

export class RoleResponseDTO extends IntersectionType(
  CreateRoleDTO,
  BaseResponseDTO,
) {}
