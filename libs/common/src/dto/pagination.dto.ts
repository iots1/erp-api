import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsInt, IsPositive, Min } from 'class-validator';

import { IPagination } from '@lib/common/interfaces/response/pagination.interface';

/**
 * Pagination metadata returned alongside paginated collections.
 */
export class PaginationDTO implements IPagination {
  @ApiProperty({
    description: 'Current page number (1-indexed)',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  @Min(1)
  @Type(() => Number)
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  @Min(1)
  @Type(() => Number)
  page_size: number;

  @ApiProperty({
    description: 'Total number of items across all pages',
    example: 105,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  total: number;

  @ApiProperty({
    description: 'Total number of records',
    example: 105,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  total_records: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 11,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  total_pages: number;
}
