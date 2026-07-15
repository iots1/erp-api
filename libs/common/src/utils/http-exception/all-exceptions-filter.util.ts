import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { FastifyReply } from 'fastify';
import { QueryFailedError } from 'typeorm';

import { IErrorObject } from '@lib/common/interfaces/response/error-object.interface';

import { InvalidParameterException } from './invalid-parameter.exception';
import { ValidationException } from './validation.exception';

const HTTP_ERROR_META: Record<number, { code: string; title: string }> = {
  [HttpStatus.BAD_REQUEST]: { code: 'BAD_REQUEST', title: 'Invalid Request' },
  [HttpStatus.UNAUTHORIZED]: { code: 'UNAUTHORIZED', title: 'Unauthorized' },
  [HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', title: 'Access Denied' },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', title: 'Not Found' },
  [HttpStatus.CONFLICT]: { code: 'CONFLICT', title: 'Duplicate Record' },
  [HttpStatus.UNPROCESSABLE_ENTITY]: {
    code: 'UNPROCESSABLE_ENTITY',
    title: 'Unprocessable Request',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'TOO_MANY_REQUESTS',
    title: 'Too Many Requests',
  },
  [HttpStatus.INTERNAL_SERVER_ERROR]: {
    code: 'INTERNAL_SERVER_ERROR',
    title: 'Server Error',
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: 'SERVICE_UNAVAILABLE',
    title: 'Service Unavailable',
  },
};

/**
 * Global HTTP exception filter that normalizes every error into a consistent
 * JSON:API-style error envelope.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    // --- 1. Invalid query-parameter format ---
    if (exception instanceof InvalidParameterException) {
      void response.status(exception.getStatus()).send({
        status: { code: 400002, message: 'Invalid Parameters' },
        errors: exception.validationErrors.map((error: IErrorObject) => ({
          code: 'INVALID_PARAMETER_FORMAT',
          title: 'Invalid Parameter Format',
          detail: error.message,
          source: { parameter: error.field },
        })),
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // --- 2. DTO validation failures ---
    if (exception instanceof ValidationException) {
      void response.status(exception.getStatus()).send({
        status: { code: 400001, message: 'Validation Failed' },
        errors: exception.validationErrors.flatMap((error) =>
          error.messages.map((message) => ({
            code: 'VALIDATION_ERROR',
            title: 'Invalid Input',
            detail: message,
            source: { pointer: `/data/attributes/${error.field}` },
          })),
        ),
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // --- 3. Standard NestJS HttpExceptions ---
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const errorResponse = exception.getResponse();
      const meta = HTTP_ERROR_META[status];

      let code: string | number = meta?.code ?? status;
      let title: string = meta?.title ?? 'An error occurred';
      let detail = 'An error occurred';
      let customStatusCode: string | number | null = null;

      if (typeof errorResponse === 'string') {
        detail = errorResponse;
      } else if (typeof errorResponse === 'object' && errorResponse !== null) {
        const r = errorResponse as Record<string, unknown>;
        code = (r['code'] as string | number | undefined) ?? code;
        title = (r['title'] as string | undefined) ?? title;
        detail =
          (r['detail'] as string | undefined) ??
          (r['message'] as string | undefined) ??
          detail;
        customStatusCode = (r['status'] as string | undefined) ?? null;
      }

      void response.status(status).send({
        status: {
          code: customStatusCode ?? status,
          message: exception.message,
        },
        errors: [{ code, title, detail }],
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // --- 4. TypeORM query failures ---
    if (exception instanceof QueryFailedError) {
      const driverError = (exception as unknown as Record<string, unknown>)
        .driverError as Record<string, unknown> | undefined;
      const dbDetail =
        (driverError?.detail as string | undefined) ??
        (driverError?.message as string | undefined) ??
        exception.message;

      this.logger.error(
        `QueryFailedError: ${exception.message}`,
        exception.stack,
      );

      const status = HttpStatus.UNPROCESSABLE_ENTITY;
      void response.status(status).send({
        status: { code: status, message: 'Database Query Error' },
        errors: [
          {
            code: 'QUERY_FAILED',
            title: 'Database Operation Failed',
            detail: dbDetail,
          },
        ],
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    // --- 5. Catch-all ---
    const errorMessage =
      exception instanceof Error ? exception.message : String(exception);
    const errorStack =
      exception instanceof Error
        ? exception.stack
        : JSON.stringify(exception, null, 2);

    this.logger.error(`Unhandled Exception: ${errorMessage}`, errorStack);

    const status = HttpStatus.INTERNAL_SERVER_ERROR;
    void response.status(status).send({
      status: { code: status, message: 'Internal Server Error' },
      errors: [
        {
          code: 'INTERNAL_SERVER_ERROR',
          title: 'An unexpected error occurred',
          detail: 'Please try again later or contact support.',
        },
      ],
      meta: { timestamp: new Date().toISOString() },
    });
  }
}
