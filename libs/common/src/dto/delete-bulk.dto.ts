import { ApiProperty } from '@nestjs/swagger';

import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsString,
  IsUUID,
} from 'class-validator';

export class DeleteBulkDTO {
  @ApiProperty({
    description: 'Array List ID (UUID)',
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    ],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsUUID('all', { each: true })
  ids: string[];
}

export class DeleteBulkResponseDTO {
  @ApiProperty({
    description: 'Number of deleted records',
    example: 2,
  })
  @IsNumber()
  deleted_count: number;

  @ApiProperty({
    description: 'Soft delete status',
    example: true,
  })
  @IsBoolean()
  soft_delete: boolean;
}
