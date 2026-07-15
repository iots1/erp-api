// json-api-response.schema.ts
import { HttpStatus } from '@nestjs/common';

export interface SwaggerResponseOptions {
  description?: string;
  exampleAttributes?: Record<string, unknown>;
  exampleId?: string;
  includeLinks?: boolean;
  includePagination?: boolean;
  statusCode?: number;
  statusMessage?: string;
}

interface SwaggerSchemaProperty {
  type: string;
  example?: unknown;
  format?: string;
  nullable?: boolean;
  properties?: Record<string, SwaggerSchemaProperty>;
  items?: SwaggerSchemaProperty;
}

interface SwaggerSchema {
  type: string;
  properties: Record<string, SwaggerSchemaProperty>;
}

/**
 * Creates a Swagger schema for a single resource JSON:API response
 */
export function createJsonApiResponseSchema(
  resourceType: string,
  options: SwaggerResponseOptions = {},
): SwaggerSchema {
  const {
    exampleAttributes = {},
    exampleId = '653da0c7-936b-4cb5-b3c1-5864564f6eff',
    includeLinks = true,
    statusCode = 200000,
    statusMessage = 'Request Succeeded',
  } = options;

  const dataProperties: Record<string, SwaggerSchemaProperty> = {
    type: { type: 'string', example: resourceType },
    id: { type: 'string', example: exampleId },
    attributes: {
      type: 'object',
      properties: exampleAttributes as Record<string, SwaggerSchemaProperty>,
    },
  };

  if (includeLinks) {
    dataProperties.links = {
      type: 'object',
      properties: {
        self: {
          type: 'string',
          example:
            'https://api-meditech-dev.dudee-indeed.com/business-bc/v1/resource/id',
        },
      },
    };
  }

  const schemaProperties: Record<string, SwaggerSchemaProperty> = {
    data: {
      type: 'object',
      properties: dataProperties,
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
    status: {
      type: 'object',
      properties: {
        code: { type: 'number', example: statusCode },
        message: { type: 'string', example: statusMessage },
      },
    },
  };

  if (includeLinks) {
    schemaProperties.links = {
      type: 'object',
      properties: {
        self: {
          type: 'string',
          example:
            'https://api-meditech-dev.dudee-indeed.com/business-bc/v1/resource',
        },
      },
    };
  }

  return {
    type: 'object',
    properties: schemaProperties,
  };
}

/**
 * Creates a Swagger schema for a collection JSON:API response
 */
export function createJsonApiCollectionResponseSchema(
  resourceType: string,
  options: SwaggerResponseOptions = {},
): SwaggerSchema {
  const {
    exampleAttributes = {},
    includePagination = false,
    statusCode = 200000,
    statusMessage = 'Request Succeeded',
  } = options;

  const metaProperties: Record<string, SwaggerSchemaProperty> = {
    timestamp: {
      type: 'string',
      format: 'date-time',
      example: new Date().toISOString(),
    },
  };

  if (includePagination) {
    metaProperties.pagination = {
      type: 'object',
      properties: {
        page: { type: 'number', example: 1 },
        page_size: { type: 'number', example: 10 },
        total: { type: 'number', example: 100 },
        total_pages: { type: 'number', example: 10 },
      },
    };
  }

  const schemaProperties: Record<string, SwaggerSchemaProperty> = {
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
            type: 'object',
            properties: exampleAttributes as Record<
              string,
              SwaggerSchemaProperty
            >,
          },
        },
      },
    },
    meta: {
      type: 'object',
      properties: metaProperties,
    },
    status: {
      type: 'object',
      properties: {
        code: { type: 'number', example: statusCode },
        message: { type: 'string', example: statusMessage },
      },
    },
  };

  if (includePagination) {
    schemaProperties.links = {
      type: 'object',
      properties: {
        self: {
          type: 'string',
          example:
            'https://api-meditech-dev.dudee-indeed.com/business-bc/v1/resource?page=1&limit=10',
        },
        first: {
          type: 'string',
          example:
            'https://api-meditech-dev.dudee-indeed.com/business-bc/v1/resource?page=1&limit=10',
        },
        last: {
          type: 'string',
          example:
            'https://api-meditech-dev.dudee-indeed.com/business-bc/v1/resource?page=10&limit=10',
        },
        next: {
          type: 'string',
          example:
            'https://api-meditech-dev.dudee-indeed.com/business-bc/v1/resource?page=2&limit=10',
        },
      },
    };
  }

  return {
    type: 'object',
    properties: schemaProperties,
  };
}

/**
 * Creates a Swagger schema for a 201 Created JSON:API response
 */
export function createJsonApiCreatedResponseSchema(
  resourceType: string,
  options: SwaggerResponseOptions = {},
): SwaggerSchema {
  return createJsonApiResponseSchema(resourceType, {
    ...options,
    statusCode: Number(`${HttpStatus.CREATED}000`),
    statusMessage: 'Created successfully',
    includeLinks: true,
  });
}
