/**
 * TypeORM Query Builder Utility
 *
 * @version 1.0.2
 * @date 2026-03-11
 * @description Transforms REST API query parameters into TypeORM FindManyOptions.
 */

import { BadRequestException } from '@nestjs/common';

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import {
  And,
  Between,
  EntityMetadata,
  Equal,
  FindManyOptions,
  FindOperator,
  FindOptionsOrder,
  FindOptionsSelect,
  FindOptionsWhere,
  ILike,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Not,
  ObjectLiteral,
  Raw,
  Repository,
} from 'typeorm';

import { MAX_QUERY_LIMIT } from '@lib/common/constants/pagination.constants';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import { InvalidParameterException } from '@lib/common/utils/http-exception/invalid-parameter.exception';

// ============================================================================
// DAYJS PLUGIN INITIALIZATION
// ============================================================================
dayjs.extend(utc);
dayjs.extend(timezone);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

const SEARCH_OPERATORS = [
  '>',
  '>=',
  '<',
  '<=',
  '!=',
  'ieq',
  'cont',
  'starts',
  'ends',
  'in',
  'between',
] as const;

type SearchOperator = (typeof SEARCH_OPERATORS)[number];

const SEARCH_OPERATOR_SET: ReadonlySet<string> = new Set(SEARCH_OPERATORS);

export const FILTER_OPERATORS = [
  '$eq',
  '$ieq',
  '$ne',
  '$gt',
  '$lt',
  '$gte',
  '$lte',
  '$cont',
  '$starts',
  '$ends',
  '$in',
  '$notin',
  '$isnull',
  '$notnull',
  '$between',
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export const FILTER_OPERATOR_SET: ReadonlySet<string> = new Set(
  FILTER_OPERATORS,
);

/**
 * Canonical operator vocabulary for JSONB conditions.
 *
 * `s` (SearchOperator) and `filter`/`or` (FilterOperator) are two independent public
 * vocabularies — each maps into this internal set via its own dedicated map below, so
 * one SQL builder serves both without the vocabularies leaking into each other.
 * Adding a JSONB operator therefore happens in exactly one place per vocabulary,
 * preventing the mapper/builder desync that shipped the `$ieq` bug.
 */
type JsonbOperator =
  | 'eq'
  | 'ieq'
  | 'ne'
  | 'cont'
  | 'starts'
  | 'ends'
  | 'in'
  | 'isnull'
  | 'notnull';

const JSONB_OPERATOR_BY_FILTER: ReadonlyMap<FilterOperator, JsonbOperator> =
  new Map([
    ['$eq', 'eq'],
    ['$ieq', 'ieq'],
    ['$ne', 'ne'],
    ['$cont', 'cont'],
    ['$starts', 'starts'],
    ['$ends', 'ends'],
    ['$in', 'in'],
    ['$isnull', 'isnull'],
    ['$notnull', 'notnull'],
  ]);

const JSONB_OPERATOR_BY_SEARCH: ReadonlyMap<SearchOperator, JsonbOperator> =
  new Map([
    ['!=', 'ne'],
    ['ieq', 'ieq'],
    ['cont', 'cont'],
    ['starts', 'starts'],
    ['ends', 'ends'],
    ['in', 'in'],
  ]);

type ComparisonDirection = 'greater' | 'less' | 'equal';

const DATE_COLUMN_TYPES = [
  'timestamp',
  'timestamptz',
  'date',
  'datetime',
  'time',
  'time with time zone',
] as const;

// Operators whose value is compared directly against a date/timestamp column and must
// therefore be validated as a date. Null-checks, membership and text operators are excluded.
const DATE_COMPARISON_FILTER_OPERATORS = new Set<FilterOperator>([
  '$eq',
  '$ne',
  '$gt',
  '$lt',
  '$gte',
  '$lte',
]);
const DATE_COMPARISON_SEARCH_OPERATORS = new Set<SearchOperator>([
  '>',
  '>=',
  '<',
  '<=',
  '!=',
]);

// Operators whose value(s) are compared directly against a Postgres `enum` column.
// An unrecognized value reaches Postgres verbatim and throws 22P02 (invalid_text_representation)
// as a raw 500 instead of a clean 400 — validate against the column's enum members first.
const ENUM_COMPARISON_FILTER_OPERATORS = new Set<FilterOperator>([
  '$eq',
  '$ne',
  '$in',
  '$notin',
]);

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_RELATION_PATTERN = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/;
const DANGEROUS_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// ============================================================================
// MAIN CLASS
// ============================================================================

export class TypeOrmQueryBuilder<T extends ObjectLiteral> {
  private static readonly DEFAULT_TIMEZONE = 'Asia/Bangkok';
  private static readonly DEFAULT_LIMIT = 10;
  private static readonly MIN_LIMIT = 1;
  private static readonly MIN_PAGE = 1;
  /**
   * Fallback cap on `?limit=` when `QUERY_MAX_LIMIT` is not set (e.g. unit tests).
   * Mirrors the HTTP-layer {@link MAX_QUERY_LIMIT} so both ceilings stay consistent.
   */
  private static readonly FALLBACK_MAX_LIMIT = MAX_QUERY_LIMIT;

  private readonly query: QueryParamsDTO;
  private jsonbParamCounter = 0;

  constructor(
    private readonly repository: Repository<T>,
    query: QueryParamsDTO,
  ) {
    this.query = query ?? {};
  }

  build(allowedRelations: string[] = []): FindManyOptions<T> {
    const findOptions: FindManyOptions<T> = {};

    this.applyPagination(findOptions);
    this.applySorting(findOptions);
    this.applyFilters(findOptions);
    this.applyExclusions(findOptions);
    this.applyRelations(findOptions, allowedRelations);
    this.applyFieldSelection(findOptions);

    // Use separate IN-queries per relation instead of a single JOIN.
    // Avoids Cartesian-product row explosion when multiple OneToMany
    // relations are loaded simultaneously (e.g. visits with orders,
    // assessments, group_orders, and diagnoses).
    findOptions.relationLoadStrategy = 'query';

    return findOptions;
  }

  // ========================================================================
  // PAGINATION
  // ========================================================================
  private applyPagination(findOptions: FindManyOptions<T>): void {
    const requestedLimit = this.parsePositiveInteger(
      this.query?.limit,
      TypeOrmQueryBuilder.DEFAULT_LIMIT,
      TypeOrmQueryBuilder.MIN_LIMIT,
    );

    // Hard cap on page size to block single-shot bulk export (e.g. ?limit=5000).
    // Clamps (does not error) so pagination metadata stays consistent.
    const limit = Math.min(requestedLimit, this.resolveMaxLimit());

    const page = this.parsePositiveInteger(
      this.query?.page,
      TypeOrmQueryBuilder.MIN_PAGE,
      TypeOrmQueryBuilder.MIN_PAGE,
    );

    const offset = Number(this.query?.offset);

    findOptions.take = limit;
    findOptions.skip = this.isValidOffset(offset) ? offset : (page - 1) * limit;
  }

  private parsePositiveInteger(
    value: unknown,
    defaultValue: number,
    minValue: number,
  ): number {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return defaultValue;
    return Math.max(minValue, Math.floor(parsed));
  }

  /**
   * Resolve the maximum allowed page size from `QUERY_MAX_LIMIT` (validated and
   * assigned to process.env by ConfigModule), falling back to
   * {@link FALLBACK_MAX_LIMIT} when unset/invalid. Each microservice can override
   * the default via its own `.env`.
   */
  private resolveMaxLimit(): number {
    const fromEnv = Number(process.env.QUERY_MAX_LIMIT);
    return Number.isFinite(fromEnv) && fromEnv > 0
      ? Math.floor(fromEnv)
      : TypeOrmQueryBuilder.FALLBACK_MAX_LIMIT;
  }

  private isValidOffset(offset: number): boolean {
    return !isNaN(offset) && offset >= 0;
  }

  // ========================================================================
  // SORTING
  // ========================================================================
  private applySorting(findOptions: FindManyOptions<T>): void {
    const sortString = this.query?.sort;

    if (!this.isNonEmptyString(sortString)) return;

    findOptions.order = this.parseSortString(sortString);
  }

  private parseSortString(sortString: string): FindOptionsOrder<T> {
    const order: Record<string, 'ASC' | 'DESC'> = {};
    const fields = sortString.split(',');
    const fieldsToValidate: string[] = [];

    for (const field of fields) {
      const [key, direction] = this.parseSortField(field);
      if (key !== null) {
        fieldsToValidate.push(key);
        order[key] = direction;
      }
    }

    // Validate all sort fields to prevent DB 500 errors
    if (fieldsToValidate.length > 0) {
      this.validateFieldNamesRecursive(fieldsToValidate);
    }

    return order as FindOptionsOrder<T>;
  }

  private parseSortField(field: string): [string | null, 'ASC' | 'DESC'] {
    const parts = field.split(':');
    const key = parts[0]?.trim();

    if (key === undefined || key === '') return [null, 'ASC'];

    const rawDirection = parts[1]?.trim()?.toUpperCase();
    const direction = rawDirection === 'DESC' ? 'DESC' : 'ASC';

    return [key, direction];
  }

  // ========================================================================
  // FILTERING
  // ========================================================================
  private applyFilters(findOptions: FindManyOptions<T>): void {
    const searchConditions = this.parseSearchParameter();
    const filterConditions = this.parseFilterParameter();
    const orConditions = this.parseOrParameter();

    const andConditions = this.deepMerge(searchConditions, filterConditions);
    const transformedAndConditions = this.transformNullValues(andConditions);

    findOptions.where = this.combineAndOrConditions(
      transformedAndConditions,
      orConditions,
    );
  }

  private combineAndOrConditions(
    andConditions: FindOptionsWhere<T>,
    orConditions: FindOptionsWhere<T>[],
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    const hasAndConditions = Object.keys(andConditions).length > 0;
    const hasOrConditions = orConditions.length > 0;

    if (!hasAndConditions && !hasOrConditions) return {};
    if (!hasOrConditions) return andConditions;
    if (!hasAndConditions) return orConditions;

    return orConditions.map((orCondition) =>
      this.deepMerge(andConditions, orCondition),
    );
  }

  private deepMerge(
    target: FindOptionsWhere<T>,
    source: FindOptionsWhere<T>,
  ): FindOptionsWhere<T> {
    const result: Record<string, unknown> = { ...target };

    for (const key of Object.keys(source)) {
      const sourceValue = source[key as keyof T];
      const targetValue = result[key];

      if (targetValue === undefined) {
        result[key] = sourceValue;
        continue;
      }

      if (
        this.isPlainObject(sourceValue) &&
        this.isPlainObject(targetValue) &&
        !this.isTypeOrmOperator(sourceValue) &&
        !this.isTypeOrmOperator(targetValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as FindOptionsWhere<T>,
          sourceValue as FindOptionsWhere<T>,
        );
        continue;
      }

      result[key] = And(
        this.ensureFindOperator(targetValue),
        this.ensureFindOperator(sourceValue),
      );
    }

    return result as FindOptionsWhere<T>;
  }

  private isPlainObject(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isTypeOrmOperator(value: unknown): value is FindOperator<unknown> {
    if (!this.isPlainObject(value)) return false;
    const obj = value as Record<string, unknown>;
    return '_type' in obj || '_value' in obj || '_getSql' in obj;
  }

  private ensureFindOperator(value: unknown): FindOperator<unknown> {
    if (this.isTypeOrmOperator(value)) {
      return value;
    }
    return Equal(value);
  }

  // --- Search Parameter ('s') ---
  private parseSearchParameter(): FindOptionsWhere<T> {
    const searchParam = this.query?.s;

    if (searchParam === undefined || searchParam === null) {
      return {};
    }

    if (typeof searchParam !== 'string' && typeof searchParam !== 'object') {
      return {};
    }

    try {
      const conditions = this.parseSearchConditions(searchParam);
      return this.buildSearchWhereClause(conditions);
    } catch (error: unknown) {
      if (error instanceof InvalidParameterException) {
        throw error;
      }
      throw new InvalidParameterException([
        {
          field: 's',
          message:
            'Invalid search parameter format. Must be a valid JSON string.',
        },
      ]);
    }
  }

  private parseSearchConditions(
    searchParam: string | object,
  ): Record<string, unknown> {
    const parsed =
      typeof searchParam === 'object'
        ? (searchParam as Record<string, unknown>)
        : (JSON.parse(searchParam) as Record<string, unknown>);

    return this.stripDangerousKeys(parsed);
  }

  private stripDangerousKeys(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const key of Object.keys(obj)) {
      if (DANGEROUS_PROTO_KEYS.has(key)) continue;

      const value = obj[key];
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        sanitized[key] = this.stripDangerousKeys(
          value as Record<string, unknown>,
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private buildSearchWhereClause(
    conditions: Record<string, unknown>,
  ): FindOptionsWhere<T> {
    this.validateFieldNamesRecursive(Object.keys(conditions));

    let where: FindOptionsWhere<T> = {};

    for (const key of Object.keys(conditions)) {
      const condition = conditions[key];

      if (this.isJsonbPath(key)) {
        const extracted = this.extractJsonbColumnAndPath(key);
        if (extracted) {
          const { column, jsonPath } = extracted;
          const conditionValue = this.buildJsonbSearchCondition(
            column,
            jsonPath,
            condition,
          );
          const singleCondition: Record<string, unknown> = {
            [column]: conditionValue,
          };
          where = this.deepMerge(where, singleCondition as FindOptionsWhere<T>);
        }
        continue;
      }

      const isDateColumn = this.isDateColumnRecursive(key);

      const conditionValue = this.buildConditionValue(condition, isDateColumn);

      if (key.includes('.')) {
        this.setNestedValue(where, key, conditionValue);
      } else {
        (where as Record<string, unknown>)[key] = conditionValue;
      }
    }

    return where;
  }

  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || !this.isPlainObject(current[part])) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;
  }

  private buildConditionValue(
    condition: unknown,
    isDateColumn: boolean,
  ): unknown {
    if (this.isOperatorObject(condition)) {
      return this.processOperatorCondition(
        condition as Record<string, unknown>,
        isDateColumn,
      );
    }

    if (isDateColumn) {
      return this.processDateValue(condition, 'equal');
    }

    return condition;
  }

  private isOperatorObject(condition: unknown): boolean {
    return (
      typeof condition === 'object' &&
      condition !== null &&
      !Array.isArray(condition)
    );
  }

  private processOperatorCondition(
    operatorObj: Record<string, unknown>,
    isDateColumn: boolean,
  ): unknown {
    const operators = Object.keys(operatorObj);

    // Preserve legacy behavior for `{}`: no operator means no constraint value;
    // transformNullValues() downstream converts it to IS NULL.
    if (operators.length === 0) return undefined;

    // Every key must be a known SearchOperator. Previously only the first key was
    // read (silently dropping the rest — `{">=":a,"<=":b}` lost the upper bound)
    // and unknown operators silently degraded to equality.
    const conditions = operators.map((rawOperator) => {
      this.assertValidSearchOperator(rawOperator);
      const operator = rawOperator;
      let value = operatorObj[operator];

      if (isDateColumn) {
        if (operator === 'between') {
          value = this.processDateRangeValue(value);
        } else if (DATE_COMPARISON_SEARCH_OPERATORS.has(operator)) {
          // Only comparison operators compare the value against the timestamp column.
          // Operators like 'like'/'in' must not be date-validated here.
          const direction = this.mapSearchOperatorToDirection(operator);
          value = this.processDateValue(value, direction);
        }
      }

      return this.applySearchOperator(operator, value);
    });

    if (conditions.length === 1) return conditions[0];

    return And(
      ...conditions.map((condition) => this.ensureFindOperator(condition)),
    );
  }

  private assertValidSearchOperator(
    operator: string,
  ): asserts operator is SearchOperator {
    if (!SEARCH_OPERATOR_SET.has(operator)) {
      throw new InvalidParameterException([
        {
          field: 's',
          message: `Invalid search operator: '${operator}'. Allowed operators are: [${SEARCH_OPERATORS.join(', ')}]`,
        },
      ]);
    }
  }

  private processDateRangeValue(value: unknown): unknown {
    if (!Array.isArray(value) || value.length !== 2) {
      return value;
    }

    const [start, end] = value as [unknown, unknown];
    const processedStart = this.processDateValue(start, 'greater');
    const processedEnd = this.processDateValue(end, 'less');

    return [processedStart, processedEnd];
  }

  private mapSearchOperatorToDirection(
    operator: SearchOperator,
  ): ComparisonDirection {
    switch (operator) {
      case '>':
      case '>=':
        return 'greater';
      case '<':
      case '<=':
        return 'less';
      default:
        return 'equal';
    }
  }

  private applySearchOperator(
    operator: SearchOperator,
    value: unknown,
  ): unknown {
    switch (operator) {
      case '>':
        return MoreThan(value);
      case '>=':
        return MoreThanOrEqual(value);
      case '<':
        return LessThan(value);
      case '<=':
        return LessThanOrEqual(value);
      case '!=':
        return Not(value);
      case 'cont':
        return ILike(`%${String(value)}%`);
      case 'ieq':
        return ILike(String(value));
      case 'starts':
        return ILike(`${String(value)}%`);
      case 'ends':
        return ILike(`%${String(value)}`);
      case 'in':
        return In(Array.isArray(value) ? value : [value]);
      case 'between':
        return this.createBetweenOperator(value);
      default:
        // Unreachable: operators are validated by assertValidSearchOperator().
        // Throw (never fall back to raw equality) if a new operator is added
        // to SEARCH_OPERATORS without a case here.
        throw new InvalidParameterException([
          {
            field: 's',
            message: `Unhandled search operator: '${String(operator)}'.`,
          },
        ]);
    }
  }

  private createBetweenOperator(value: unknown): ReturnType<typeof Between> {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new InvalidParameterException([
        {
          field: 'between',
          message:
            'Between operator requires an array with exactly 2 values: [start, end]',
        },
      ]);
    }

    const [start, end] = value as [unknown, unknown];
    return Between(start, end);
  }

  // --- Filter Parameter ---
  private parseFilterParameter(): FindOptionsWhere<T> {
    const filters = this.normalizeFilterInput();

    if (filters.length === 0) return {};

    const parsedFilters = this.parseFilterStrings(filters);

    const fieldNames = parsedFilters.map((f) => f.field);
    this.validateFieldNamesRecursive(fieldNames);

    return this.buildFilterWhereClause(parsedFilters);
  }

  private parseOrParameter(): FindOptionsWhere<T>[] {
    const orFilters = this.normalizeOrInput();

    if (orFilters.length === 0) return [];

    const parsedFilters = this.parseFilterStrings(orFilters);

    if (parsedFilters.length === 0) return [];

    const fieldNames = parsedFilters.map((f) => f.field);
    this.validateFieldNamesRecursive(fieldNames);

    return this.buildOrWhereClause(parsedFilters);
  }

  private normalizeOrInput(): string[] {
    const orParam = this.query?.or as unknown;

    if (orParam === undefined || orParam === null) return [];
    if (typeof orParam === 'string')
      return orParam.trim().length > 0 ? [orParam] : [];
    if (Array.isArray(orParam)) {
      return orParam.filter(
        (f): f is string => typeof f === 'string' && f.trim().length > 0,
      );
    }

    return [];
  }

  private buildOrWhereClause(
    filters: Array<{ field: string; operator: FilterOperator; value: string }>,
  ): FindOptionsWhere<T>[] {
    const orConditions: FindOptionsWhere<T>[] = [];

    for (const { field, operator, value } of filters) {
      const condition: Record<string, unknown> = {};

      if (this.isJsonbPath(field)) {
        const extracted = this.extractJsonbColumnAndPath(field);
        if (extracted) {
          const { column, jsonPath } = extracted;
          condition[column] = this.buildJsonbRawCondition(
            column,
            jsonPath,
            this.mapFilterOperatorToJsonbOperator(operator, column),
            value,
          );
        }
        const transformedCondition = this.transformNullValues(
          condition as FindOptionsWhere<T>,
        );
        orConditions.push(transformedCondition);
        continue;
      }

      this.validateEnumValueForFilter(field, operator, value);

      const isDateColumn = this.isDateColumnRecursive(field);
      const processedValue = isDateColumn
        ? this.processDateValueForFilter(value, operator)
        : value;

      const operatorValue = this.applyFilterOperator(operator, processedValue);

      if (field.includes('.')) {
        this.setNestedValue(condition, field, operatorValue);
      } else {
        condition[field] = operatorValue;
      }

      const transformedCondition = this.transformNullValues(
        condition as FindOptionsWhere<T>,
      );
      orConditions.push(transformedCondition);
    }

    return orConditions;
  }

  private normalizeFilterInput(): string[] {
    const filter = this.query?.filter as unknown;

    if (filter === undefined || filter === null) return [];
    if (typeof filter === 'string')
      return filter.trim().length > 0 ? [filter] : [];
    if (Array.isArray(filter)) {
      return filter.filter(
        (f): f is string => typeof f === 'string' && f.trim().length > 0,
      );
    }

    return [];
  }

  private parseFilterStrings(filters: string[]): Array<{
    field: string;
    operator: FilterOperator;
    value: string;
  }> {
    const parsed: Array<{
      field: string;
      operator: FilterOperator;
      value: string;
    }> = [];

    for (const filter of filters) {
      const parts = filter.split('||');

      // Must have at least 3 parts
      if (parts.length < 3) continue;

      const field = parts[0];
      const operator = parts[1];
      // Join the rest in case the value itself contains '||'
      const value = parts.slice(2).join('||');

      const trimmedField = field?.trim() ?? '';
      const trimmedOperator = operator?.trim() ?? '';
      if (trimmedField.length === 0 || trimmedOperator.length === 0) continue;

      // Reject unknown operators as 400. Without this guard an operator typo
      // (e.g. `$eqq`) silently degraded to equality against the raw value —
      // returning wrong result sets instead of surfacing the client error.
      if (!FILTER_OPERATOR_SET.has(trimmedOperator)) {
        throw new InvalidParameterException([
          {
            field: trimmedField,
            message: `Invalid filter operator: '${trimmedOperator}'. Allowed operators are: [${FILTER_OPERATORS.join(', ')}]`,
          },
        ]);
      }

      parsed.push({
        field: trimmedField,
        operator: trimmedOperator as FilterOperator,
        value: value ?? '',
      });
    }

    return parsed;
  }

  private buildFilterWhereClause(
    filters: Array<{ field: string; operator: FilterOperator; value: string }>,
  ): FindOptionsWhere<T> {
    let where: FindOptionsWhere<T> = {};

    for (const { field, operator, value } of filters) {
      if (this.isJsonbPath(field)) {
        const extracted = this.extractJsonbColumnAndPath(field);
        if (extracted) {
          const { column, jsonPath } = extracted;
          const operatorValue = this.buildJsonbRawCondition(
            column,
            jsonPath,
            this.mapFilterOperatorToJsonbOperator(operator, column),
            value,
          );
          const singleCondition: Record<string, unknown> = {
            [column]: operatorValue,
          };
          where = this.deepMerge(where, singleCondition as FindOptionsWhere<T>);
        }
        continue;
      }

      this.validateEnumValueForFilter(field, operator, value);

      const isDateColumn = this.isDateColumnRecursive(field);
      const processedValue = isDateColumn
        ? this.processDateValueForFilter(value, operator)
        : value;

      const operatorValue = this.applyFilterOperator(operator, processedValue);

      // Construct single condition for deepMerge
      const singleCondition: Record<string, unknown> = {};

      if (field.includes('.')) {
        this.setNestedValue(singleCondition, field, operatorValue);
      } else {
        singleCondition[field] = operatorValue;
      }

      // Use deepMerge to properly combine conditions on the same field
      where = this.deepMerge(where, singleCondition as FindOptionsWhere<T>);
    }

    return where;
  }

  /**
   * Validates a filter value against a Postgres `enum` column's allowed members before it
   * reaches the driver. Without this, an unrecognized value (wrong case, typo, stale client
   * constant) throws a raw 22P02 from Postgres instead of a descriptive 400.
   */
  private validateEnumValueForFilter(
    field: string,
    operator: FilterOperator,
    value: string,
  ): void {
    if (!ENUM_COMPARISON_FILTER_OPERATORS.has(operator)) return;

    const allowedValues = this.getEnumValuesRecursive(field);
    if (!allowedValues) return;

    const candidates =
      operator === '$in' || operator === '$notin'
        ? this.parseCommaSeparatedValues(value)
        : [value];

    for (const candidate of candidates) {
      if (candidate === '' || this.isNullishLiteral(candidate)) continue;
      if (!allowedValues.includes(candidate)) {
        throw new InvalidParameterException([
          {
            field,
            message: `Invalid value '${candidate}' for enum field '${field}'. Allowed values are: [${allowedValues.join(', ')}]`,
          },
        ]);
      }
    }
  }

  private processDateValueForFilter(
    value: string,
    operator: FilterOperator,
  ): string {
    if (operator === '$between') {
      return this.processDateRangeString(value);
    }

    // Only comparison operators compare the value against the timestamp column.
    // Null-checks ($isnull/$notnull) and membership/text operators must not be date-validated.
    if (!DATE_COMPARISON_FILTER_OPERATORS.has(operator)) {
      return value;
    }

    const direction = this.mapFilterOperatorToDirection(operator);
    const processed = this.processDateValue(value, direction);
    return typeof processed === 'string' ? processed : value;
  }

  private processDateRangeString(value: string): string {
    const parts = value.split(',').map((v) => v.trim());

    if (parts.length !== 2) {
      return value;
    }

    const [start, end] = parts;

    const processedStart = this.processDateValue(start, 'greater');
    const processedEnd = this.processDateValue(end, 'less');

    const startStr =
      typeof processedStart === 'string' ? processedStart : start;
    const endStr = typeof processedEnd === 'string' ? processedEnd : end;

    return `${startStr},${endStr}`;
  }

  private mapFilterOperatorToDirection(
    operator: FilterOperator,
  ): ComparisonDirection {
    switch (operator) {
      case '$gt':
      case '$gte':
        return 'greater';
      case '$lt':
      case '$lte':
        return 'less';
      default:
        return 'equal';
    }
  }

  private applyFilterOperator(
    operator: FilterOperator,
    value: string,
  ): unknown {
    switch (operator) {
      case '$eq':
        // A literal "null"/"undefined" reaches Postgres verbatim and throws 22P02 (invalid
        // input syntax) on typed columns such as uuid/int/timestamp. Treat it as an IS NULL
        // check, consistent with how empty values are handled in transformNullValues().
        return this.isNullishLiteral(value) ? IsNull() : value;
      case '$ieq':
        return ILike(value);
      case '$ne':
        return this.isNullishLiteral(value) ? Not(IsNull()) : Not(value);
      case '$gt':
        return MoreThan(value);
      case '$lt':
        return LessThan(value);
      case '$gte':
        return MoreThanOrEqual(value);
      case '$lte':
        return LessThanOrEqual(value);
      case '$cont':
        return ILike(`%${value}%`);
      case '$starts':
        return ILike(`${value}%`);
      case '$ends':
        return ILike(`%${value}`);
      case '$in':
        return In(this.parseCommaSeparatedValues(value));
      case '$notin':
        return Not(In(this.parseCommaSeparatedValues(value)));
      case '$isnull':
        return value.toLowerCase() === 'false' ? Not(IsNull()) : IsNull();
      case '$notnull':
        return value.toLowerCase() === 'false' ? IsNull() : Not(IsNull());
      case '$between':
        return this.createBetweenFromString(value);
      default:
        // Unreachable: operators are validated in parseFilterStrings().
        // Throw (never fall back to raw equality) if a new operator is added
        // to FILTER_OPERATORS without a case here.
        throw new InvalidParameterException([
          {
            field: 'filter',
            message: `Unhandled filter operator: '${String(operator)}'.`,
          },
        ]);
    }
  }

  /**
   * A filter value of the literal string "null" or "undefined" (case-insensitive) represents
   * an IS NULL intent — typically sent when a UI serializes a cleared filter and the field's
   * JS value was `null`/`undefined`. Without this guard the string is passed straight to
   * Postgres and throws 22P02 (invalid input syntax) on typed columns (uuid/int/date).
   */
  private isNullishLiteral(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized === 'null' || normalized === 'undefined';
  }

  private createBetweenFromString(value: string): ReturnType<typeof Between> {
    const parts = this.parseCommaSeparatedValues(value);

    if (parts.length !== 2) {
      throw new InvalidParameterException([
        {
          field: '$between',
          message:
            'Between operator requires exactly 2 comma-separated values: start,end',
        },
      ]);
    }

    const [start, end] = parts;
    return Between(start, end);
  }

  private parseCommaSeparatedValues(value: string): string[] {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  private transformNullValues(
    conditions: FindOptionsWhere<T>,
  ): FindOptionsWhere<T> {
    const transformed: Record<string, unknown> = {};

    for (const key of Object.keys(conditions)) {
      const value = conditions[key as keyof T];

      if (value === undefined || value === '') {
        transformed[key] = IsNull();
      } else if (typeof value === 'string' && this.isNullishLiteral(value)) {
        // Plain-equality path (e.g. search `s`) never routes through applyFilterOperator,
        // so a literal "null"/"undefined" string would otherwise hit Postgres verbatim
        // and throw 22P02 on typed columns. Normalize it to IS NULL here.
        transformed[key] = IsNull();
      } else if (this.isPlainObject(value) && !this.isTypeOrmOperator(value)) {
        transformed[key] = this.transformNullValues(
          value as FindOptionsWhere<T>,
        );
      } else {
        transformed[key] = value;
      }
    }

    return transformed as FindOptionsWhere<T>;
  }

  // ========================================================================
  // DATE PROCESSING
  // ========================================================================
  private get timezone(): string {
    return this.query?.timezone ?? TypeOrmQueryBuilder.DEFAULT_TIMEZONE;
  }

  /**
   * Resolves the column metadata for a (possibly dot-nested, relation-qualified)
   * field path, e.g. `finding_type` or `visit_order.status`. Shared by date and
   * enum column checks so both stay in sync on how relation traversal works.
   */
  private resolveColumnMetadata(
    fieldPath: string,
  ): ReturnType<EntityMetadata['findColumnWithPropertyName']> {
    if (!fieldPath.includes('.')) {
      return this.repository.metadata.findColumnWithPropertyName(fieldPath);
    }

    const parts = fieldPath.split('.');
    let currentMetadata: EntityMetadata = this.repository.metadata;

    for (let i = 0; i < parts.length - 1; i++) {
      const relation = currentMetadata.findRelationWithPropertyPath(parts[i]);

      if (!relation) return undefined;

      currentMetadata = relation.inverseEntityMetadata;
    }

    return currentMetadata.findColumnWithPropertyName(parts[parts.length - 1]);
  }

  private isDateColumnRecursive(fieldPath: string): boolean {
    const column = this.resolveColumnMetadata(fieldPath);
    if (!column) return false;

    return DATE_COLUMN_TYPES.includes(
      column.type as (typeof DATE_COLUMN_TYPES)[number],
    );
  }

  /**
   * Returns the allowed enum values for a field path, or `null` when the field
   * is not a Postgres `enum` column.
   */
  private getEnumValuesRecursive(fieldPath: string): string[] | null {
    const column = this.resolveColumnMetadata(fieldPath);
    if (!column || column.type !== 'enum' || !Array.isArray(column.enum))
      return null;

    return column.enum.map((value) => String(value));
  }

  private processDateValue(
    value: unknown,
    direction: ComparisonDirection,
  ): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    // Empty string is converted to IS NULL downstream by transformNullValues — let it pass through.
    if (value.trim() === '') {
      return value;
    }

    const isDateOnly = DATE_ONLY_REGEX.test(value);

    if (isDateOnly) {
      return this.expandDateOnlyValue(value, direction);
    }

    if (dayjs(value).isValid() === true) {
      const hasTimezone = value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value);

      if (hasTimezone) {
        return dayjs(value).toISOString();
      }

      return dayjs.tz(value, this.timezone).toISOString();
    }

    // Field targets a date column but the value is not a parseable date.
    // Reject as 400 here instead of letting Postgres throw 22007 (500 + error-level log flood).
    throw new InvalidParameterException([
      {
        field: 'date',
        message: `Invalid date value: '${value}'. Expected an ISO date or datetime string.`,
      },
    ]);
  }

  private expandDateOnlyValue(
    dateString: string,
    direction: ComparisonDirection,
  ): string {
    const localDate = dayjs.tz(dateString, this.timezone);

    switch (direction) {
      case 'greater':
        return localDate.startOf('day').toISOString();
      case 'less':
        return localDate.endOf('day').toISOString();
      case 'equal':
      default:
        return localDate.startOf('day').toISOString();
    }
  }

  // ========================================================================
  // RELATION LOADING
  // ========================================================================
  private applyRelations(
    findOptions: FindManyOptions<T>,
    allowedRelations: string[],
  ): void {
    const relationsParam = this.query?.relations;

    if (!this.isNonEmptyString(relationsParam)) return;

    findOptions.relations = this.validateAndParseRelations(
      relationsParam,
      allowedRelations,
    );
  }

  private validateAndParseRelations(
    relationsString: string,
    allowedRelations: string[],
  ): string[] {
    const requested = this.parseCommaSeparatedValues(relationsString);

    if (allowedRelations.length === 0 && requested.length > 0) {
      throw new BadRequestException(
        'No relations are allowed for this endpoint.',
      );
    }

    for (const relation of requested) {
      if (!VALID_RELATION_PATTERN.test(relation)) {
        throw new BadRequestException(
          `Invalid characters in requested relation: '${relation}'`,
        );
      }

      if (!allowedRelations.includes(relation)) {
        throw new BadRequestException(`Relation not allowed: '${relation}'`);
      }
    }

    return requested;
  }

  // ========================================================================
  // FIELD SELECTION
  // ========================================================================
  private applyFieldSelection(findOptions: FindManyOptions<T>): void {
    const fieldsParam = this.query?.fields;

    if (!this.isNonEmptyString(fieldsParam)) return;

    findOptions.select = this.parseAndValidateFields(
      fieldsParam,
    ) as FindOptionsSelect<T>;
  }

  private parseAndValidateFields(
    fieldsString: string,
  ): Record<string, boolean | Record<string, unknown>> {
    const requestedFields = this.parseCommaSeparatedValues(fieldsString);

    const rootPrimaryColumns = this.repository.metadata.primaryColumns.map(
      (col) => col.propertyName,
    );
    for (const pk of rootPrimaryColumns) {
      if (!requestedFields.includes(pk)) {
        requestedFields.push(pk);
      }
    }

    const selectObject: Record<string, boolean | Record<string, unknown>> = {};

    for (const fieldPath of requestedFields) {
      if (!fieldPath.includes('.')) {
        if (this.isValidColumn(this.repository.metadata, fieldPath)) {
          selectObject[fieldPath] = true;
          continue;
        }
        throw new InvalidParameterException([
          { field: 'fields', message: `Invalid column: '${fieldPath}'` },
        ]);
      }

      this.buildNestedSelect(selectObject, fieldPath);
    }

    return selectObject;
  }

  private buildNestedSelect(
    currentSelect: Record<string, boolean | Record<string, unknown>>,
    path: string,
  ): void {
    const parts = path.split('.');
    let currentMetadata: EntityMetadata = this.repository.metadata;
    let currentLevel: Record<string, unknown> = currentSelect;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        if (!this.isValidColumn(currentMetadata, part)) {
          throw new InvalidParameterException([
            {
              field: 'fields',
              message: `Invalid nested column: '${part}' in path '${path}'`,
            },
          ]);
        }
        currentLevel[part] = true;
      } else {
        const relation = currentMetadata.findRelationWithPropertyPath(part);
        if (!relation) {
          throw new InvalidParameterException([
            {
              field: 'fields',
              message: `Invalid relation: '${part}' in path '${path}'`,
            },
          ]);
        }

        if (currentLevel[part] === true) {
          continue;
        } else if (
          typeof currentLevel[part] !== 'object' ||
          currentLevel[part] === null
        ) {
          currentLevel[part] = {};
        }

        const relationMetadata = relation.inverseEntityMetadata;
        const relationTarget = currentLevel[part] as Record<string, unknown>;

        // A relation is a "pass-through" when the requested leaf column
        // lives on a DEEPER relation (e.g. `group_orders.diagnoses.lookup_created_by.username`
        // — here `group_orders` and `diagnoses` are pass-throughs, `lookup_created_by`
        // owns the leaf). Selecting only the primary key of a pass-through would strip
        // all of that entity's own domain columns, so load its full column set instead.
        // Only the entity that directly owns the requested leaf column stays
        // column-restricted (primary key + the explicitly listed columns).
        const isPassThrough = i < parts.length - 2;
        const columnsToSelect = isPassThrough
          ? relationMetadata.columns.map((col) => col.propertyName)
          : relationMetadata.primaryColumns.map((col) => col.propertyName);

        for (const column of columnsToSelect) {
          // Never clobber an already-nested relation object with `true`.
          if (relationTarget[column] !== undefined) continue;
          relationTarget[column] = true;
        }

        currentLevel = relationTarget;
        currentMetadata = relation.inverseEntityMetadata;
      }
    }
  }

  private isValidColumn(metadata: EntityMetadata, columnName: string): boolean {
    return !!metadata.findColumnWithPropertyName(columnName);
  }

  // ========================================================================
  // VALIDATION HELPERS
  // ========================================================================
  private validateFieldNamesRecursive(fields: string[]): void {
    for (const fieldPath of fields) {
      if (this.isJsonbPath(fieldPath)) {
        continue;
      }

      if (!fieldPath.includes('.')) {
        const validFields = this.getEntityPropertyNames();
        if (!validFields.includes(fieldPath)) {
          throw new InvalidParameterException([
            {
              field: fieldPath,
              message: `Invalid filter field: '${fieldPath}'. Allowed fields are: [${validFields.join(', ')}]`,
            },
          ]);
        }
        continue;
      }

      const parts = fieldPath.split('.');
      let currentMetadata: EntityMetadata = this.repository.metadata;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;

        if (isLast) {
          const column = currentMetadata.findColumnWithPropertyName(part);
          if (!column) {
            const validColumns = currentMetadata.columns.map(
              (col) => col.propertyName,
            );
            throw new InvalidParameterException([
              {
                field: fieldPath,
                message: `Invalid nested column: '${part}' in path '${fieldPath}'. Allowed columns are: [${validColumns.join(', ')}]`,
              },
            ]);
          }
        } else {
          const relation = currentMetadata.findRelationWithPropertyPath(part);
          if (!relation) {
            const validRelations = currentMetadata.relations.map(
              (rel) => rel.propertyPath,
            );
            throw new InvalidParameterException([
              {
                field: fieldPath,
                message: `Invalid relation: '${part}' in path '${fieldPath}'. Allowed relations are: [${validRelations.join(', ')}]`,
              },
            ]);
          }
          currentMetadata = relation.inverseEntityMetadata;
        }
      }
    }
  }

  private getEntityPropertyNames(): string[] {
    return this.repository.metadata.columns.map((col) => col.propertyName);
  }

  private isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
  }

  // ========================================================================
  // JSONB HELPERS
  // ========================================================================

  private isJsonbColumn(propertyName: string): boolean {
    const column =
      this.repository.metadata.findColumnWithPropertyName(propertyName);
    if (!column) return false;
    return column.type === 'jsonb' || column.type === 'json';
  }

  private isJsonbPath(fieldPath: string): boolean {
    const firstSegment = fieldPath.split('.')[0];
    return (
      firstSegment !== undefined &&
      firstSegment.length > 0 &&
      this.isJsonbColumn(firstSegment)
    );
  }

  private extractJsonbColumnAndPath(
    fieldPath: string,
  ): { column: string; jsonPath: string[] } | null {
    const parts = fieldPath.split('.');
    if (parts.length < 2) return null;
    const [column, ...jsonPath] = parts;
    if (!this.isJsonbColumn(column)) return null;
    return { column, jsonPath };
  }

  private buildJsonbRawCondition(
    column: string,
    jsonPath: string[],
    operator: JsonbOperator,
    value: string,
  ): FindOperator<unknown> {
    const paramPrefix = `jsonb_${this.jsonbParamCounter++}_`;

    // Bind every JSON path segment as a query parameter and traverse via the
    // `#>>` operator against a parameterized text[] path. User-controlled path
    // segments never touch the raw SQL string (no interpolation/escaping), which
    // eliminates the JSONB-path injection vector entirely. `#>> {a,b,c}` returns
    // the leaf value as text — equivalent to the former `->'a'->'b'->>'c'` chain.
    const pathParams: Record<string, string> = {};
    const pathPlaceholders = jsonPath.map((segment, index) => {
      const pName = `${paramPrefix}p${index}`;
      pathParams[pName] = segment;
      return `:${pName}`;
    });
    const pathArraySql = `ARRAY[${pathPlaceholders.join(', ')}]::text[]`;

    // `column` is a validated entity property name (see isJsonbColumn); the table
    // alias is supplied by TypeORM, not the client. Both are safely quoted.
    const accessor = (alias: string): string => {
      const dotIndex = alias.indexOf('.');
      const columnRef =
        dotIndex > 0
          ? `"${alias.substring(0, dotIndex)}"."${column}"`
          : `"${column}"`;
      return `${columnRef} #>> ${pathArraySql}`;
    };

    const buildRaw = (
      sqlFactory: (columnAccessor: string) => string,
      valueParams: Record<string, string> = {},
    ): FindOperator<unknown> =>
      Raw((alias) => sqlFactory(accessor(alias)), {
        ...pathParams,
        ...valueParams,
      });

    // Empty string semantics mirror regular columns (IS NULL)
    if ((operator === 'eq' || operator === 'ne') && value === '') {
      return operator === 'eq'
        ? buildRaw((acc) => `${acc} IS NULL`)
        : buildRaw((acc) => `${acc} IS NOT NULL`);
    }

    switch (operator) {
      case 'eq': {
        const paramName = `${paramPrefix}v`;
        return buildRaw((acc) => `${acc} = :${paramName}`, {
          [paramName]: value,
        });
      }
      case 'ieq': {
        // Case-insensitive exact match — ILIKE without wildcards, mirroring
        // `$ieq`/`ieq` semantics on regular columns.
        const paramName = `${paramPrefix}v`;
        return buildRaw((acc) => `${acc} ILIKE :${paramName}`, {
          [paramName]: value,
        });
      }
      case 'ne': {
        const paramName = `${paramPrefix}v`;
        return buildRaw((acc) => `${acc} != :${paramName}`, {
          [paramName]: value,
        });
      }
      case 'cont': {
        const paramName = `${paramPrefix}v`;
        return buildRaw((acc) => `${acc} ILIKE :${paramName}`, {
          [paramName]: `%${value}%`,
        });
      }
      case 'starts': {
        const paramName = `${paramPrefix}v`;
        return buildRaw((acc) => `${acc} ILIKE :${paramName}`, {
          [paramName]: `${value}%`,
        });
      }
      case 'ends': {
        const paramName = `${paramPrefix}v`;
        return buildRaw((acc) => `${acc} ILIKE :${paramName}`, {
          [paramName]: `%${value}`,
        });
      }
      case 'in': {
        const values = this.parseCommaSeparatedValues(value);
        if (values.length === 0) {
          return Raw(() => '1 = 0');
        }
        const valueParams: Record<string, string> = {};
        const placeholders = values.map((v, i) => {
          const pName = `${paramPrefix}i${i}`;
          valueParams[pName] = v;
          return `:${pName}`;
        });
        return buildRaw(
          (acc) => `${acc} IN (${placeholders.join(',')})`,
          valueParams,
        );
      }
      case 'isnull': {
        return value.toLowerCase() === 'false'
          ? buildRaw((acc) => `${acc} IS NOT NULL`)
          : buildRaw((acc) => `${acc} IS NULL`);
      }
      case 'notnull': {
        return value.toLowerCase() === 'false'
          ? buildRaw((acc) => `${acc} IS NULL`)
          : buildRaw((acc) => `${acc} IS NOT NULL`);
      }
      default:
        // Unreachable: callers map into JsonbOperator via the dedicated
        // vocabulary maps, which throw for unsupported operators.
        throw new InvalidParameterException([
          {
            field: column,
            message: `Unhandled JSONB operator: '${String(operator)}'.`,
          },
        ]);
    }
  }

  private buildJsonbSearchCondition(
    column: string,
    jsonPath: string[],
    condition: unknown,
  ): unknown {
    if (!this.isOperatorObject(condition)) {
      // Plain value -> treat as equality
      return this.buildJsonbRawCondition(
        column,
        jsonPath,
        'eq',
        String(condition),
      );
    }

    const operatorObj = condition as Record<string, unknown>;
    const operators = Object.keys(operatorObj);

    if (operators.length === 0) {
      throw new InvalidParameterException([
        {
          field: 's',
          message: `JSONB search condition for '${column}' requires an operator object with at least one operator.`,
        },
      ]);
    }

    // Every key must be a known SearchOperator supported on JSONB. Previously
    // only the first key was read and the rest were silently dropped.
    const conditions = operators.map((rawOperator) => {
      this.assertValidSearchOperator(rawOperator);
      const jsonbOperator = this.mapSearchOperatorToJsonbOperator(rawOperator);
      return this.buildJsonbRawCondition(
        column,
        jsonPath,
        jsonbOperator,
        String(operatorObj[rawOperator]),
      );
    });

    if (conditions.length === 1) return conditions[0];

    return And(...conditions);
  }

  private mapFilterOperatorToJsonbOperator(
    operator: FilterOperator,
    column: string,
  ): JsonbOperator {
    const mapped = JSONB_OPERATOR_BY_FILTER.get(operator);
    if (mapped === undefined) {
      throw new InvalidParameterException([
        {
          field: column,
          message: `Operator '${operator}' is not supported for JSONB fields in this version. Supported: ${[...JSONB_OPERATOR_BY_FILTER.keys()].join(', ')}.`,
        },
      ]);
    }
    return mapped;
  }

  private mapSearchOperatorToJsonbOperator(
    operator: SearchOperator,
  ): JsonbOperator {
    const mapped = JSONB_OPERATOR_BY_SEARCH.get(operator);
    if (mapped === undefined) {
      throw new InvalidParameterException([
        {
          field: 's',
          message: `Search operator '${operator}' is not supported for JSONB fields. Supported: ${[...JSONB_OPERATOR_BY_SEARCH.keys()].join(', ')}.`,
        },
      ]);
    }
    return mapped;
  }

  // ========================================================================
  // EXCLUSIONS
  // ========================================================================
  private applyExclusions(findOptions: FindManyOptions<T>): void {
    const rawExcludeIds = this.query?.exclude_ids;

    if (
      rawExcludeIds === undefined ||
      rawExcludeIds === null ||
      rawExcludeIds === ''
    ) {
      return;
    }

    let excludeIds: string[];
    if (typeof rawExcludeIds === 'string') {
      excludeIds = rawExcludeIds
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
    } else if (Array.isArray(rawExcludeIds)) {
      excludeIds = (rawExcludeIds as string[]).filter(
        (id: string) => typeof id === 'string' && id.length > 0,
      );
    } else {
      return;
    }

    if (excludeIds.length === 0) {
      return;
    }

    const primaryColumn = this.repository.metadata.primaryColumns[0] as
      (typeof this.repository.metadata.primaryColumns)[number] | undefined;
    if (primaryColumn === undefined) return;
    const pkName = primaryColumn.propertyName;

    const exclusionCondition = {
      [pkName]: Not(In(excludeIds)),
    } as FindOptionsWhere<T>;

    if (!findOptions.where) {
      findOptions.where = exclusionCondition;
    } else if (Array.isArray(findOptions.where)) {
      findOptions.where = findOptions.where.map((cond) =>
        this.deepMerge(cond, exclusionCondition),
      );
    } else {
      findOptions.where = this.deepMerge(findOptions.where, exclusionCondition);
    }
  }
}
