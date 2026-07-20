import { ApiProperty } from '@nestjs/swagger';

import { IsArray, IsUUID } from 'class-validator';

export class AttachAccessKeyPolicyDTO {
  @IsArray()
  @IsUUID('4', { each: true })
  @ApiProperty({
    description:
      'รายการ policy id ที่ต้องการ attach เข้า access key (แทนที่ policy เดิมทั้งหมด)',
    type: [String],
  })
  policy_ids: string[];
}
