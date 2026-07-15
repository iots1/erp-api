import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { FastifyReply } from 'fastify';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { RESOURCE_TYPE_KEY } from '@lib/common/decorators/resource-type.decorator';
import { IPagination } from '@lib/common/interfaces/response/pagination.interface';

import {
  createCreatedResponse,
  createPaginatedResponse,
  createSuccessCollectionResponse,
  createSuccessResponse,
} from './json-api.util';

interface PaginatedData {
  data: unknown[];
  pagination: IPagination;
  [key: string]: unknown;
}

/**
 * Wraps controller return values into JSON:API responses. Controllers opt in by
 * declaring `@ResourceType('...')`; without it, the raw value is passed through.
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        const resourceType = this.reflector.get<string>(
          RESOURCE_TYPE_KEY,
          context.getClass(),
        );

        if (!resourceType) {
          return data;
        }

        const response = context.switchToHttp().getResponse<FastifyReply>();
        const statusCode = Number(response.statusCode);

        const request = context.switchToHttp().getRequest<{
          protocol?: string;
          hostname?: string;
          url?: string;
        }>();
        const protocol = request.protocol ?? 'http';
        const host = request.hostname ?? '';
        const path = request.url ?? '';
        const baseUrl = `${protocol}://${host}${path}`;

        const isPaginatedData = (value: unknown): value is PaginatedData => {
          if (typeof value !== 'object' || value === null) return false;
          if (!('pagination' in value && 'data' in value)) return false;
          return Array.isArray((value as Record<string, unknown>)['data']);
        };

        if (isPaginatedData(data)) {
          const { data: items, pagination, ...rest } = data;
          const extraMeta = Object.keys(rest).length > 0 ? rest : undefined;
          return createPaginatedResponse(
            resourceType,
            items,
            pagination,
            baseUrl,
            extraMeta != null ? { meta: extraMeta } : undefined,
          );
        }

        if (Array.isArray(data)) {
          return createSuccessCollectionResponse(resourceType, data);
        }

        if (
          statusCode === Number(HttpStatus.CREATED) &&
          typeof data === 'object' &&
          data !== null
        ) {
          const location = `${baseUrl}/${(data as { id: string | number }).id}`;
          return createCreatedResponse(resourceType, data, location, baseUrl);
        }

        if (typeof data === 'object' && data !== null) {
          return createSuccessResponse(resourceType, data, baseUrl);
        }

        return data;
      }),
    );
  }
}
