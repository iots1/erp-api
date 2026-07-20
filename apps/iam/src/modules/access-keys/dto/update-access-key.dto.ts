import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

import { IsISO8601 } from '@lib/common/decorators/custom-validate-dto/is-iso-8601.decorator';

import { AccessKeyStatus } from '../enums/access-key-status.enum';

export class UpdateAccessKeyDTO {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Warehouse-Integration' })
  name?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @IsOptional()
  @IsEnum(AccessKeyStatus)
  @ApiPropertyOptional({
    description: 'เปลี่ยนสถานะ key — เมื่อ revoked แล้วไม่สามารถเปลี่ยนกลับได้',
    enum: AccessKeyStatus,
  })
  status?: AccessKeyStatus;

  @IsOptional()
  @IsISO8601()
  @ApiPropertyOptional({ nullable: true })
  expires_at?: string | null;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({ nullable: true })
  metadata?: Record<string, unknown> | null;
}
