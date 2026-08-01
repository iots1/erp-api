import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordResponseDTO {
  @ApiProperty({
    format: 'uuid',
    example: '00000000-0000-0000-0000-000000000001',
    description: 'ผู้ใช้ ID',
  })
  id: string;

  @ApiProperty({
    description:
      'รหัสผ่านชั่วคราวที่ระบบสุ่มให้ — ปรากฏเฉพาะใน response นี้เท่านั้น (ไม่ถูกเก็บและไม่สามารถเรียกดูซ้ำได้)',
    example: 'aB3!kx9Qm2Lz',
  })
  temp_password: string;
}
