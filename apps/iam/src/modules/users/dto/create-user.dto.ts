import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

import type { UserStatus } from '../entities/user.entity';

export class CreateUserDTO {
  @IsString()
  @ApiProperty({ description: 'ชื่อผู้ใช้ (unique)', example: 'jane.doe' })
  username: string;

  @IsString()
  @ApiProperty({ description: 'รหัสพนักงาน', example: 'EMP-1024' })
  employee_id: string;

  @IsString()
  @ApiProperty({ description: 'ชื่อ-นามสกุล', example: 'Jane Doe' })
  full_name: string;

  @IsEmail()
  @ApiProperty({ description: 'อีเมล (unique)', example: 'jane.doe@erp.local' })
  email: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'แผนก/สังกัด',
    example: 'Warehouse',
    nullable: true,
  })
  department: string | null;

  @IsOptional()
  @IsIn(['active', 'pending', 'suspended'])
  @ApiPropertyOptional({
    description: 'active | pending | suspended',
    example: 'pending',
  })
  status: UserStatus;
}
