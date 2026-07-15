import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

import type { ConditionOperator } from '../entities/statement-condition.entity';
import type {
  StatementEffect,
  StatementPlane,
} from '../entities/policy-statement.entity';

export class StatementConditionInputDTO {
  @IsString()
  @ApiProperty({ example: 'StringEquals' })
  operator: ConditionOperator;

  @IsString()
  @ApiProperty({ example: 'customer.owner_id' })
  condition_key: string;

  @IsString()
  @ApiProperty({ example: '${user.id}' })
  condition_value: string;
}

export class PolicyStatementInputDTO {
  @IsIn(['allow', 'deny'])
  @ApiProperty({ example: 'allow' })
  effect: StatementEffect;

  @IsIn(['ui', 'api'])
  @ApiProperty({ example: 'api' })
  plane: StatementPlane;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @ApiProperty({
    description: 'ระบบ/บริการเป้าหมาย',
    type: [String],
    example: ['inventory-bc'],
  })
  service: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @ApiProperty({
    description: 'ทรัพยากร (หรือ *)',
    type: [String],
    example: ['goods_receipt'],
  })
  resource: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  @ApiProperty({
    description: 'permission id ที่อนุญาต/ปฏิเสธ',
    type: [String],
  })
  permission_ids: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatementConditionInputDTO)
  @ApiPropertyOptional({ type: [StatementConditionInputDTO] })
  conditions: StatementConditionInputDTO[];
}

export class SetStatementsDTO {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyStatementInputDTO)
  @ApiProperty({ type: [PolicyStatementInputDTO] })
  statements: PolicyStatementInputDTO[];
}
