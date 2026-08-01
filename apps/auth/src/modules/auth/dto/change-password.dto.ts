import { ApiProperty } from '@nestjs/swagger';

import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDTO {
  @IsString()
  @ApiProperty({ description: 'รหัสผ่านปัจจุบัน (หรือรหัสผ่านชั่วคราวที่ได้รับ)' })
  current_password: string;

  @IsString()
  @MinLength(8)
  @ApiProperty({ description: 'รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)' })
  new_password: string;

  @IsString()
  @ApiProperty({ description: 'ยืนยันรหัสผ่านใหม่ — ต้องตรงกับ new_password' })
  confirm_password: string;
}
