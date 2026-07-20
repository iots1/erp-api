import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { IsISO8601 } from '@lib/common/decorators/custom-validate-dto/is-iso-8601.decorator';

import { AccessKeyStatus } from '../enums/access-key-status.enum';

export class CreateAccessKeyDTO {
  @IsString()
  @ApiProperty({
    description: 'ชื่อ Access Key',
    example: 'Warehouse-Integration',
  })
  name: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'รายละเอียดการใช้งาน', nullable: true })
  description: string | null;

  @IsUUID()
  @ApiProperty({
    description: 'UUID ของ user หรือ service account ที่เป็นเจ้าของ',
  })
  owner_id: string;

  @IsEnum(['user', 'service_account'])
  @ApiProperty({
    description: 'ประเภทของ owner',
    enum: ['user', 'service_account'],
    example: 'service_account',
  })
  owner_type: 'user' | 'service_account';

  @IsOptional()
  @IsISO8601()
  @ApiPropertyOptional({
    description: 'วันหมดอายุ (ISO 8601) — ไม่ระบุ = ไม่มีวันหมดอายุ',
    nullable: true,
    example: '2027-01-01T00:00:00.000Z',
  })
  expires_at?: string | null;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description: 'ข้อมูลเพิ่มเติม เช่น IP whitelist',
    nullable: true,
    example: { ip_whitelist: ['192.168.1.1'] },
  })
  metadata?: Record<string, unknown> | null;
}

export class CreateAccessKeyResponseDTO {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'AKIAIOSFODNN7EXAMPLE' })
  access_key_id: string;

  @ApiProperty({
    description:
      'Secret key แบบ plaintext — แสดงเพียงครั้งเดียว ต้องเก็บไว้อย่างปลอดภัย',
  })
  secret_key: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: AccessKeyStatus, example: AccessKeyStatus.ACTIVE })
  status: AccessKeyStatus;

  @ApiPropertyOptional({ nullable: true })
  expires_at: string | null;
}
