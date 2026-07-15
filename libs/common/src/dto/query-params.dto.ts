import { ApiPropertyOptional } from '@nestjs/swagger';

import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsJSON,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

import { toJsonSearchOrUndefined } from '../utils/dto-transforms.util';

export class QueryParamsDTO {
  @ApiPropertyOptional({
    description:
      'หมายเลขหน้าปัจจุบัน ref. https://iots1.github.io/enterprise-backend-blueprint/guides/base-operations-architecture/#pagination',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'หมายเลขเริ่มต้นข้อมูล',
    default: 0,
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number;

  @ApiPropertyOptional({
    description: 'จำนวนรายการต่อหน้า',
    default: 10,
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'การเรียงลำดับข้อมูล รูปแบบ "field:direction" ref. https://iots1.github.io/enterprise-backend-blueprint/guides/base-operations-architecture/#sorting',
    examples: {
      'เรียงตามวันที่สร้าง (ใหม่สุดไปเก่าสุด)': {
        value: 'created_at:desc',
      },

      'เรียงตามชื่อ (A-Z)': {
        value: 'first_name:asc',
      },
      เรียงหลายเงื่อนไข: {
        value: 'first_name:asc,created_at:desc',
      },
    },
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description:
      'เงื่อนไขการค้นหาในรูปแบบ JSON ref. https://iots1.github.io/enterprise-backend-blueprint/guides/base-operations-architecture/#filtering-method-1-s-json-search',
    example: '{"status":"active", "age":{">":25}}',
  })
  @IsOptional()
  @IsJSON({ message: '' })
  @Transform(toJsonSearchOrUndefined)
  s?: string | object;

  @ApiPropertyOptional({
    description:
      'Add filters with format: field||operator||value ref. https://iots1.github.io/enterprise-backend-blueprint/guides/base-operations-architecture/#filtering-method-2-filter',
    example: 'status||$eq||active',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  @IsOptional()
  @Transform(({ value }): string[] => {
    if (Array.isArray(value)) {
      return value as string[];
    }
    if (typeof value === 'string') {
      return value.trim().length > 0 ? [value] : [];
    }
    return [];
  })
  filter?: string[] = [];

  @ApiPropertyOptional({
    description:
      'Add OR conditions with format: field||operator||value (combined with OR logic) ref. https://iots1.github.io/enterprise-backend-blueprint/guides/base-operations-architecture/#or-query-support-disjunctive-conditions',
    example: 'is_public||$eq||true',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  @IsOptional()
  @Transform(({ value }): string[] => {
    if (Array.isArray(value)) {
      return value as string[];
    }
    if (typeof value === 'string') {
      return value.trim().length > 0 ? [value] : [];
    }
    return [];
  })
  or?: string[] = [];

  @ApiPropertyOptional({
    description: 'A comma-separated list of relations to eager load.',
    example: 'created_by,addresses',
    type: String,
  })
  @IsOptional()
  @IsString()
  relations?: string;

  @ApiPropertyOptional({
    description:
      'A comma-separated list of fields to include in the response (sparse fieldsets). ref. https://iots1.github.io/enterprise-backend-blueprint/guides/base-operations-architecture/#field-selection-sparse-fieldsets',
    example: 'id,first_name,email',
    type: String,
  })
  @IsOptional()
  @IsString()
  fields?: string;

  @ApiPropertyOptional({
    description:
      'Timezone for search datetime (IANA format) ref. https://iots1.github.io/enterprise-backend-blueprint/guides/base-operations-architecture/#timezone-handling',
    default: 'Asia/Bangkok',
    example: 'Asia/Bangkok',
  })
  @IsOptional()
  @IsString()
  timezone?: string = 'Asia/Bangkok';

  @ApiPropertyOptional({
    description: 'A comma-separated list of IDs to exclude from the results.',
    example: 'uuid1,uuid2,uuid3',
    type: String,
  })
  @IsOptional()
  @IsString()
  exclude_ids?: string;

  @ApiPropertyOptional({
    description:
      'Use for case dropdown list , non-limit data ref. https://iots1.github.io/enterprise-backend-blueprint/guides/base-operations-architecture/#ignoring-pagination-limits-ignore_limit',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value === true;
  })
  ignore_limit?: boolean = false;

  @ApiPropertyOptional({
    description:
      'หากเป็น true จะส่งกลับเฉพาะจำนวนรายการทั้งหมด (count) โดยไม่ดึงข้อมูล list ref. https://iots1.github.io/enterprise-backend-blueprint/guides/base-operations-architecture/#retrieving-total-count-without-data-get_count_only',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value === true;
  })
  get_count_only?: boolean = false;

  @ApiPropertyOptional({
    description:
      'หากเป็น true เป็นการยื่นยันการลบข้อมูลแบบ hard delete (remark : ยังไม่รองรับใน base operation)',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value === true;
  })
  is_hard_delete?: boolean = false;
}

/**
 * Factory that returns a {@link QueryParamsDTO} subclass whose `relations`
 * field documents the resource-specific allowed relations in Swagger/Scalar.
 *
 * Generics are erased at runtime, so `QueryParamsDTO<T>` cannot feed Swagger an
 * example. This factory bakes the allowed list into a concrete class instead —
 * pass the BC's relation constant and use the result in both `@ApiQuery({ type })`
 * and `@ValidatedQuery()`.
 *
 * @example
 * export class VisitQueryParamsDTO extends queryParamsWithRelations(VISIT_ALLOWED_RELATIONS) {}
 */
export function queryParamsWithRelations(
  allowedRelations: readonly string[],
): typeof QueryParamsDTO {
  class QueryParamsWithRelationsDTO extends QueryParamsDTO {
    @ApiPropertyOptional({
      description: 'Relations to eager load (เลือกได้หลายรายการ).',
      isArray: true,
      enum: [...allowedRelations],
      example: allowedRelations.slice(0, 3),
    })
    @IsOptional()
    @IsString()
    @Transform(({ value }): string =>
      Array.isArray(value) ? (value as string[]).join(',') : (value as string),
    )
    relations?: string = undefined;
  }

  return QueryParamsWithRelationsDTO;
}
