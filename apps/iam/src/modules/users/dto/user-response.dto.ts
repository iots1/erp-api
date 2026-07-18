import { ApiProperty } from '@nestjs/swagger';
import { IntersectionType } from '@nestjs/swagger';

import { BaseResponseDTO } from '@lib/common/dto/base-response.dto';

import { CreateUserDTO } from './create-user.dto';

export class UserResponseDTO extends IntersectionType(
  CreateUserDTO,
  BaseResponseDTO,
) {
  @ApiProperty({
    format: 'uuid',
    example: '00000000-0000-0000-0000-000000000001',
    description: 'ผู้ใช้ ID',
  })
  id: string;
}
