import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import dayjs from 'dayjs';

/**
 * IsISO8601Constraint
 * * A validation constraint that enforces a strict ISO 8601 format.
 * Unlike standard validators, this requires a complete string including:
 * - Date (YYYY-MM-DD)
 * - Time separator (T)
 * - Time (HH:mm:ss)
 * - Timezone Offset (Z or +/-HH:mm)
 * * Examples:
 * - Valid:   2024-12-18T14:30:00Z
 * - Valid:   2024-12-18T14:30:00+07:00
 * - Invalid: 2024-12-18 (Missing time and timezone)
 * - Invalid: 2024-12-18T14:30:00 (Missing timezone context)
 */
@ValidatorConstraint({ name: 'isISO8601', async: false })
export class IsISO8601Constraint implements ValidatorConstraintInterface {
  /**
   * Strict Regex for ISO 8601 with mandatory Timezone Offset.
   * Pattern: YYYY-MM-DDTHH:mm:ss.sssZ or YYYY-MM-DDTHH:mm:ss.sss+HH:mm
   */
  private readonly ISO_8601_STRICT_REGEX =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

  /**
   * Validates whether the value is a strict ISO 8601 string with a timezone offset.
   * * @param value - The input string to be validated.
   * @returns boolean - True if the string meets strict ISO 8601 requirements.
   */
  validate(value: any): boolean {
    // Only strings are valid for this specific check
    if (typeof value !== 'string') return false;

    // 1. Structural Validation via Regex
    // This ensures the presence of 'T' and a valid Timezone Offset (Z or +/-)
    if (!this.ISO_8601_STRICT_REGEX.test(value)) {
      return false;
    }

    // 2. Logical Validity Check
    // Uses dayjs to ensure the date itself is real (e.g., rejects Feb 30th)
    return dayjs(value).isValid();
  }

  /**
   * Default error message when validation fails.
   */
  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a complete ISO 8601 string with a timezone offset (e.g., 2024-12-18T14:30:00+07:00 or 2024-12-18T14:30:00Z)`;
  }
}

/**
 * @IsISO8601()
 * * A custom decorator for DTOs to enforce a complete ISO 8601 string format.
 * This eliminates ambiguity regarding timezones and ensures the backend
 * does not have to guess the client's local context.
 * * @param validationOptions - Standard class-validator options.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function IsISO8601(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsISO8601Constraint,
    });
  };
}
