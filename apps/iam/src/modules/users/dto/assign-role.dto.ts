import { ApiProperty } from '@nestjs/swagger';

import { IsArray, IsUUID } from 'class-validator';

export class AssignRoleDTO {
  @IsArray()
  @IsUUID('4', { each: true })
  @ApiProperty({
    description:
      'รายการ role id ที่ต้องการกำหนดให้ผู้ใช้ (แทนที่ role เดิมทั้งหมด)',
    type: [String],
  })
  role_ids: string[];
}
