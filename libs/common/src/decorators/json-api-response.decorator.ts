/* eslint-disable @typescript-eslint/no-unsafe-function-type */
// json-api-response.decorator.ts
import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

import { SwaggerResponseOptions } from '@lib/common/swagger/json-api-response.schema';

type ValidationDetail = string | string[] | Record<string, unknown>;
type JsonApiErrorExample = {
  code?: number | string;
  title?: string;
  detail?: string;
};
type JsonApiUnauthorizedResponseModel = Type<unknown>;
type JsonApiUnauthorizedResponseInput =
  | JsonApiErrorExample
  | JsonApiErrorExample[]
  | JsonApiUnauthorizedResponseModel
  | JsonApiUnauthorizedResponseModel[];

function resolveValidationDetail(
  detail: ValidationDetail,
): Record<string, unknown> {
  if (typeof detail === 'string') return { type: 'string', example: detail };
  if (Array.isArray(detail))
    return { oneOf: detail.map((d) => ({ type: 'string', example: d })) };
  return detail;
}

function buildJsonApiErrorSchema(
  statusCode: number,
  statusMessage: string,
  errorExample: Required<JsonApiErrorExample>,
): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      status: {
        type: 'object',
        properties: {
          code: { type: 'number', example: statusCode },
          message: { type: 'string', example: statusMessage },
        },
      },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            code: { type: 'number', example: errorExample.code },
            title: { type: 'string', example: errorExample.title },
            detail: { type: 'string', example: errorExample.detail },
          },
        },
      },
      meta: {
        type: 'object',
        properties: {
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: new Date().toISOString(),
          },
        },
      },
    },
  };
}

function normalizeJsonApiErrorExamples(
  examples: JsonApiErrorExample | JsonApiErrorExample[] | undefined,
  fallbackCode: number,
  fallbackTitle: string,
  fallbackDetail: string,
): Required<JsonApiErrorExample>[] {
  const values = Array.isArray(examples) ? examples : [examples];

  return values
    .filter((example): example is JsonApiErrorExample => example !== undefined)
    .map((example) => ({
      code: example.code ?? fallbackCode,
      title: example.title ?? fallbackTitle,
      detail: example.detail ?? fallbackDetail,
    }))
    .concat(
      values.some((example) => example !== undefined)
        ? []
        : [
            {
              code: fallbackCode,
              title: fallbackTitle,
              detail: fallbackDetail,
            },
          ],
    );
}

function isSwaggerModel(value: unknown): value is Type<unknown> {
  return typeof value === 'function';
}

function normalizeJsonApiUnauthorizedResponseModels(
  input: JsonApiUnauthorizedResponseInput | undefined,
): Type<unknown>[] | null {
  if (input === undefined) {
    return null;
  }

  const values = Array.isArray(input) ? input : [input];

  if (values.every(isSwaggerModel)) {
    return values;
  }

  return null;
}

/**
 * Decorator for 201 Created JSON:API response with DTO
 */
export function ApiJsonApiCreatedResponse<TDto extends Type<unknown>>(
  resourceType: string,
  dto: TDto,
  options: Omit<SwaggerResponseOptions, 'exampleAttributes'> = {},
): <TFunction extends Function, Y>(
  target: object | TFunction,
  propertyKey?: string | symbol,
  descriptor?: TypedPropertyDescriptor<Y>,
) => void {
  const {
    description = 'Created successfully',
    exampleId = '653da0c7-936b-4cb5-b3c1-5864564f6eff',
    includeLinks = true,
  } = options;

  return applyDecorators(
    ApiExtraModels(dto),
    ApiResponse({
      status: 201,
      description,
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              type: { type: 'string', example: resourceType },
              id: { type: 'string', example: exampleId },
              attributes: {
                $ref: getSchemaPath(dto),
              },
              ...(includeLinks && {
                links: {
                  type: 'object',
                  properties: {
                    self: {
                      type: 'string',
                      example:
                        'https://api.example.com/business-bc/v1/resource/id',
                    },
                  },
                },
              }),
            },
          },
          ...(includeLinks && {
            links: {
              type: 'object',
              properties: {
                self: {
                  type: 'string',
                  example: 'https://api.example.com/business-bc/v1/resource',
                },
              },
            },
          }),
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: new Date().toISOString(),
              },
            },
          },
          status: {
            type: 'object',
            properties: {
              code: { type: 'number', example: 201000 },
              message: { type: 'string', example: 'Created successfully' },
            },
          },
        },
      },
    }),
  );
}

/**
 * Decorator for single resource JSON:API response with DTO
 */
export function ApiJsonApiResponse<TDto extends Type<unknown>>(
  resourceType: string,
  status: number,
  dto: TDto,
  options: Omit<SwaggerResponseOptions, 'exampleAttributes'> = {},
): <TFunction extends Function, Y>(
  target: object | TFunction,
  propertyKey?: string | symbol,
  descriptor?: TypedPropertyDescriptor<Y>,
) => void {
  const {
    description = 'Successful response',
    exampleId = '653da0c7-936b-4cb5-b3c1-5864564f6eff',
    includeLinks = true,
    statusCode = 200000,
    statusMessage = 'Request Succeeded',
  } = options;

  return applyDecorators(
    ApiExtraModels(dto),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              type: { type: 'string', example: resourceType },
              id: { type: 'string', example: exampleId },
              attributes: {
                $ref: getSchemaPath(dto),
              },
              ...(includeLinks && {
                links: {
                  type: 'object',
                  properties: {
                    self: {
                      type: 'string',
                      example:
                        'https://api.example.com/business-bc/v1/resource/id',
                    },
                  },
                },
              }),
            },
          },
          ...(includeLinks && {
            links: {
              type: 'object',
              properties: {
                self: {
                  type: 'string',
                  example: 'https://api.example.com/business-bc/v1/resource',
                },
              },
            },
          }),
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: new Date().toISOString(),
              },
            },
          },
          status: {
            type: 'object',
            properties: {
              code: { type: 'number', example: statusCode },
              message: { type: 'string', example: statusMessage },
            },
          },
        },
      },
    }),
  );
}

/**
 * Decorator for 404 Not Found JSON:API error response
 */
export function ApiJsonApiNotFoundResponse(
  description = 'Resource not found',
): <TFunction extends Function, Y>(
  target: object | TFunction,
  propertyKey?: string | symbol,
  descriptor?: TypedPropertyDescriptor<Y>,
) => void {
  return applyDecorators(
    ApiResponse({
      status: 404,
      description,
      schema: {
        type: 'object',
        properties: {
          status: {
            type: 'object',
            properties: {
              code: { type: 'number', example: 404000 },
              message: { type: 'string', example: 'Not Found' },
            },
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                status: { type: 'string', example: '404' },
                title: { type: 'string', example: 'Not Found' },
                detail: {
                  type: 'string',
                  example: 'The requested resource was not found',
                },
              },
            },
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: new Date().toISOString(),
              },
            },
          },
        },
      },
    }),
  );
}

/**
 * Decorator for 400 Validation Error (400001) JSON:API error response
 */
export function ApiJsonApiValidationErrorResponse(
  description?: string,
  code: number | HttpStatus = 400001,
  detail: ValidationDetail = {
    type: 'string',
    example: 'field_name must not be empty',
  },
): <TFunction extends Function, Y>(
  target: object | TFunction,
  propertyKey?: string | symbol,
  descriptor?: TypedPropertyDescriptor<Y>,
) => void {
  const swaggerLabel =
    description ?? (typeof detail === 'string' ? detail : 'Validation failed');
  const statusMessage = description ?? 'Validation failed';
  return applyDecorators(
    ApiResponse({
      status: 400,
      description: swaggerLabel,
      schema: {
        type: 'object',
        properties: {
          status: {
            type: 'object',
            properties: {
              code: { type: 'number', example: code ?? 400001 },
              message: {
                type: 'string',
                example: statusMessage,
              },
            },
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                status: { type: 'string', example: '400' },
                source: {
                  type: 'object',
                  properties: {
                    pointer: {
                      type: 'string',
                      example: '/data/attributes/field_name',
                    },
                  },
                },
                title: { type: 'string', example: 'Validation Error' },
                detail: resolveValidationDetail(detail),
              },
            },
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: new Date().toISOString(),
              },
            },
          },
        },
      },
    }),
  );
}

/**
 * Decorator for 400 Invalid Parameter (400002) JSON:API error response
 */
export function ApiJsonApiInvalidParameterResponse(
  description = 'Invalid query parameter',
): <TFunction extends Function, Y>(
  target: object | TFunction,
  propertyKey?: string | symbol,
  descriptor?: TypedPropertyDescriptor<Y>,
) => void {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description,
      schema: {
        type: 'object',
        properties: {
          status: {
            type: 'object',
            properties: {
              code: { type: 'number', example: 400002 },
              message: { type: 'string', example: 'Invalid Parameter' },
            },
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                status: { type: 'string', example: '400' },
                source: {
                  type: 'object',
                  properties: {
                    parameter: {
                      type: 'string',
                      example: 'filter',
                    },
                  },
                },
                title: { type: 'string', example: 'Invalid Parameter' },
                detail: {
                  type: 'string',
                  example: 'Invalid filter parameter value',
                },
              },
            },
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: new Date().toISOString(),
              },
            },
          },
        },
      },
    }),
  );
}

/**
 * Decorator for 401 Unauthorized JSON:API error response
 */
export function ApiJsonApiUnauthorizedResponse(
  description = 'Unauthorized',
  examples?: JsonApiUnauthorizedResponseInput,
): <TFunction extends Function, Y>(
  target: object | TFunction,
  propertyKey?: string | symbol,
  descriptor?: TypedPropertyDescriptor<Y>,
) => void {
  const responseModels = normalizeJsonApiUnauthorizedResponseModels(examples);

  if (responseModels !== null) {
    return applyDecorators(
      ApiExtraModels(...responseModels),
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description,
        schema:
          responseModels.length === 1
            ? { $ref: getSchemaPath(responseModels[0]) }
            : {
                oneOf: responseModels.map((responseModel) => ({
                  $ref: getSchemaPath(responseModel),
                })),
              },
      }),
    );
  }

  const normalizedExamples = normalizeJsonApiErrorExamples(
    examples as JsonApiErrorExample | JsonApiErrorExample[] | undefined,
    HttpStatus.UNAUTHORIZED,
    'Unauthorized',
    'Authentication failed',
  );

  return applyDecorators(
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description,
      schema:
        normalizedExamples.length === 1
          ? buildJsonApiErrorSchema(
              HttpStatus.UNAUTHORIZED,
              'Unauthorized',
              normalizedExamples[0],
            )
          : {
              oneOf: normalizedExamples.map((example) =>
                buildJsonApiErrorSchema(
                  HttpStatus.UNAUTHORIZED,
                  'Unauthorized',
                  example,
                ),
              ),
            },
    }),
  );
}

/**
 * Decorator for collection JSON:API response with DTO
 */
export function ApiJsonApiCollectionResponse<TDto extends Type<unknown>>(
  resourceType: string,
  status: number,
  dto: TDto,
  options: Omit<SwaggerResponseOptions, 'exampleAttributes'> = {},
): <TFunction extends Function, Y>(
  target: object | TFunction,
  propertyKey?: string | symbol,
  descriptor?: TypedPropertyDescriptor<Y>,
) => void {
  const {
    description = 'Successful collection response',
    includePagination = true,
    statusCode = 200000,
    statusMessage = 'Request Succeeded',
  } = options;

  return applyDecorators(
    ApiExtraModels(dto),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', example: resourceType },
                id: {
                  type: 'string',
                  example: '653da0c7-936b-4cb5-b3c1-5864564f6eff',
                },
                attributes: {
                  $ref: getSchemaPath(dto),
                },
              },
            },
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: new Date().toISOString(),
              },
              ...(includePagination && {
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number', example: 1 },
                    page_size: { type: 'number', example: 10 },
                    total: { type: 'number', example: 100 },
                    total_pages: { type: 'number', example: 10 },
                    total_records: { type: 'number', example: 200 },
                  },
                },
              }),
            },
          },
          status: {
            type: 'object',
            properties: {
              code: { type: 'number', example: statusCode },
              message: { type: 'string', example: statusMessage },
            },
          },
          ...(includePagination && {
            links: {
              type: 'object',
              properties: {
                self: {
                  type: 'string',
                  example:
                    'https://api.example.com/business-bc/v1/resource?page=1&limit=10',
                },
                first: {
                  type: 'string',
                  example:
                    'https://api.example.com/business-bc/v1/resource?page=1&limit=10',
                },
                last: {
                  type: 'string',
                  example:
                    'https://api.example.com/business-bc/v1/resource?page=10&limit=10',
                },
                next: {
                  type: 'string',
                  example:
                    'https://api.example.com/business-bc/v1/resource?page=2&limit=10',
                },
              },
            },
          }),
        },
      },
    }),
  );
}
