import { createParamDecorator, ExecutionContext, Type } from '@nestjs/common';

import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import { InvalidParameterException } from '@lib/common/utils/http-exception/invalid-parameter.exception';

/**
 * Custom Query Parameter Decorator with Validation
 *
 * This decorator combines @Query with CustomValidationPipe behavior:
 * 1. Extracts query parameters from the request
 * 2. Applies default values if specified
 * 3. Transforms plain object to DTO class instance
 * 4. Validates using class-validator decorators
 * 5. Throws InvalidParameterException (400002) on validation failure
 *
 * @example
 * Basic usage:
 * ```typescript
 * @Get()
 * findAll(@ValidatedQuery(QueryParamsDTO) query: QueryParamsDTO) {
 *   return this.service.findAll(query);
 * }
 * ```
 *
 * @example
 * With default values:
 * ```typescript
 * @Get()
 * findAll(@ValidatedQuery({
 *   dto: QueryParamsDTO,
 *   defaults: { fields: 'hn,first_name', limit: 10 }
 * }) query: QueryParamsDTO) {
 *   return this.service.findAll(query);
 * }
 * ```
 *
 * @param options - DTO class or options object with dto and defaults
 */

type RequestWithQuery = {
  query?: unknown;
};

type ValidatedQueryOptions = {
  dto: Type<object>;
  defaults?: Record<string, unknown>;
};

type ValidatedQueryParam = Type<object> | ValidatedQueryOptions | undefined;

export const ValidatedQuery = createParamDecorator(
  async (
    param: ValidatedQueryParam,
    ctx: ExecutionContext,
  ): Promise<object> => {
    const request = ctx.switchToHttp().getRequest<RequestWithQuery>();

    const query = request.query;
    let queryParams: Record<string, unknown>;

    if (typeof query === 'object' && query !== null && !Array.isArray(query)) {
      queryParams = query as Record<string, unknown>;
    } else {
      queryParams = {};
    }

    // Handle backward compatibility: support both Type<object> and options object
    let dtoClass: Type<object> | undefined;
    let defaults: Record<string, unknown> = {};

    if (param === undefined || param === null) {
      return queryParams;
    }

    // Check if param is an options object with 'dto' property
    if (typeof param === 'object' && 'dto' in param) {
      const options = param;
      dtoClass = options.dto;
      defaults = options.defaults || {};
    } else {
      // Backward compatibility: treat as direct DTO class
      dtoClass = param;
    }

    // Apply default values (only for missing/undefined properties)
    const mergedParams = { ...defaults, ...queryParams };

    // Remove undefined values from query params to allow defaults to apply
    Object.keys(mergedParams).forEach((key) => {
      if (mergedParams[key] === undefined) {
        delete mergedParams[key];
      }
    });

    // Transform plain object to DTO class instance
    const dtoInstance = plainToInstance(dtoClass, mergedParams, {
      enableImplicitConversion: false, // Use explicit @Type/@Transform decorators for type conversion
      excludeExtraneousValues: false, // Don't strip unknown properties yet
    });

    // Validate the DTO instance
    const errors: ValidationError[] = await validate(dtoInstance, {
      whitelist: true, // Strip properties without decorators
      forbidNonWhitelisted: true, // Throw error on unknown properties
      validationError: {
        target: false, // Don't expose target object in error
        value: false, // Don't expose value in error
      },
    });

    // If validation fails, throw InvalidParameterException
    if (errors.length > 0) {
      const validationErrors = formatValidationErrors(errors);
      throw new InvalidParameterException(validationErrors);
    }

    return dtoInstance;
  },
);

/**
 * Format validation errors into InvalidParameterException format
 *
 * @param errors - Array of ValidationError from class-validator
 * @returns Array of formatted error objects
 */
function formatValidationErrors(
  errors: ValidationError[],
): Array<{ field: string; message: string }> {
  const formattedErrors: Array<{ field: string; message: string }> = [];

  for (const error of errors) {
    // Handle nested validation errors recursively
    if (error.children && error.children.length > 0) {
      const nestedErrors = formatValidationErrors(error.children);
      formattedErrors.push(
        ...nestedErrors.map((e) => ({
          field: `${error.property}.${e.field}`,
          message: e.message,
        })),
      );
    } else {
      // Get all constraint messages
      const messages = error.constraints
        ? Object.values(error.constraints)
        : ['Validation failed'];

      formattedErrors.push({
        field: error.property,
        message: messages.join(', '),
      });
    }
  }

  return formattedErrors;
}
