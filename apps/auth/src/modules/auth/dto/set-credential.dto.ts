import { ApiProperty } from '@nestjs/swagger';

import { IsString, IsUUID } from 'class-validator';

export class SetCredentialDTO {
  @IsUUID('4')
  @ApiProperty({ description: 'iam.users.id ที่จะตั้ง/รีเซ็ตรหัสผ่านให้' })
  user_id: string;

  @IsString()
  @ApiProperty({ example: 'jane.doe' })
  username: string;

  @IsString()
  @ApiProperty({ example: 'S3cure!Passw0rd' })
  password: string;
}
