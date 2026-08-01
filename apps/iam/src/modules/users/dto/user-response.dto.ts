import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiPropertyOptional({
    description:
      'รหัสผ่านชั่วคราวที่ระบบสุ่มให้ — ปรากฏเฉพาะใน response ของการสร้างผู้ใช้งานครั้งแรกเท่านั้น (ไม่ถูกเก็บและไม่สามารถเรียกดูซ้ำได้)',
    example: 'aB3!kx9Qm2Lz',
  })
  temp_password?: string;
}
