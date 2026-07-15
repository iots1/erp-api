import type { TransformFnParams } from 'class-transformer';

/**
 * Trim whitespace for required string fields.
 * Usage: @Transform(toTrimString)
 */
export const toTrimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Trim whitespace and convert empty string → undefined for optional string fields.
 * Usage: @Transform(toTrimOrUndefined)
 */
export const toTrimOrUndefined = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value as unknown;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/**
 * Coerce value to number with a configurable fallback (default 0).
 * Handles string numbers, null, undefined, and empty string.
 * Usage: @Transform(toNumber())  or  @Transform(toNumber(1))
 */
export const toNumber =
  (fallback = 0) =>
  ({ value }: TransformFnParams): number => {
    if (value === null || value === undefined || value === '') return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  };

/**
 * Coerce value to boolean.
 * Treats 'true', true, and 1 as true; everything else is false.
 * Usage: @Transform(toBoolean)
 */
export const toBoolean = ({ value }: TransformFnParams): boolean =>
  value === 'true' || value === true || value === 1;

/**
 * Coerce value to string.
 * returns undefined if value is null or undefined.
 * Usage: @Transform(toString)
 */
export const toString = ({ value }: TransformFnParams): string | undefined => {
  if (value === null || value === undefined) return undefined;
  return String(value);
};

/**
 * Transform JSON search param — returns undefined for empty/blank values and empty objects ({}).
 * Handles string input (raw query param), parsed object, null, and undefined.
 * Usage: @Transform(toJsonSearchOrUndefined)
 */
export const toJsonSearchOrUndefined = ({
  value,
}: TransformFnParams): unknown => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === '{}') return undefined;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed) &&
        Object.keys(parsed).length === 0
      ) {
        return undefined;
      }
    } catch {
      // not valid JSON — let @IsJSON validator handle it
    }
    return trimmed;
  }
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as object).length === 0
  ) {
    return undefined;
  }
  return value as unknown;
};
