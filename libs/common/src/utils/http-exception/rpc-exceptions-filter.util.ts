import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

import { Observable, throwError } from 'rxjs';

import { IErrorObject } from '@lib/common/interfaces/response/error-object.interface';

import { InvalidParameterException } from './invalid-parameter.exception';
import { ValidationException } from './validation.exception';

/**
 * Standardized RPC error response format, mirroring the HTTP error envelope.
 * Used by RpcExceptionsFilter to serialize RPC exceptions.
 */
export interface IRpcErrorPayload {
  status: { code: number; message: string };
  errors: Array<{
    code: number | string;
    title: string;
    detail: string;
    source?: { pointer?: string; parameter?: string };
  }>;
  meta: { timestamp: string };
}

/**
 * Catches exceptions raised inside RPC (TCP microservice) handlers and rethrows
 * them as a standardized RpcException payload, mirroring the HTTP error envelope.
 */
@Catch()
export class RpcExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): Observable<never> {
    if (host.getType() !== 'rpc') {
      throw exception;
    }
    return throwError(() => new RpcException(this.formatException(exception)));
  }

  private formatException(exception: unknown): IRpcErrorPayload {
    if (exception instanceof InvalidParameterException) {
      return {
        status: { code: 400002, message: 'Invalid Parameters' },
        errors: exception.validationErrors.map((error: IErrorObject) => ({
          code: 400002,
          title: 'Invalid Parameter Format',
          detail: error.message ?? 'Invalid parameter value',
          source: { parameter: error.field ?? 'unknown' },
        })),
        meta: { timestamp: new Date().toISOString() },
      };
    }

    if (exception instanceof ValidationException) {
      return {
        status: { code: 400001, message: 'Validation Failed' },
        errors: exception.validationErrors.flatMap((error) =>
          error.messages.map((message) => ({
            code: 400001,
            title: 'Invalid Input',
            detail: message,
            source: { pointer: `/data/attributes/${error.field}` },
          })),
        ),
        meta: { timestamp: new Date().toISOString() },
      };
    }

    if (exception instanceof RpcException) {
      const error = exception.getError();

      if (this.isRpcErrorPayload(error)) {
        return error;
      }

      if (typeof error === 'object' && error !== null) {
        const errorObj = error as Record<string, unknown>;
        const statusCode =
          (errorObj['status_code'] as number) ??
          (errorObj['statusCode'] as number) ??
          HttpStatus.INTERNAL_SERVER_ERROR;
        const message = (errorObj['message'] as string) ?? 'RPC Error';
        const errorDetail = errorObj['error'] as string | undefined;

        return {
          status: { code: statusCode, message },
          errors: [
            {
              code: statusCode,
              title: message,
              detail: errorDetail ?? message,
            },
          ],
          meta: { timestamp: new Date().toISOString() },
        };
      }

      if (typeof error === 'string') {
        return {
          status: { code: HttpStatus.INTERNAL_SERVER_ERROR, message: error },
          errors: [
            {
              code: HttpStatus.INTERNAL_SERVER_ERROR,
              title: 'RPC Error',
              detail: error,
            },
          ],
          meta: { timestamp: new Date().toISOString() },
        };
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const errorResponse = exception.getResponse();
      const detail =
        typeof errorResponse === 'string'
          ? errorResponse
          : ((errorResponse as { message?: string }).message ??
            'An error occurred');

      return {
        status: { code: status, message: exception.message },
        errors: [{ code: status, title: exception.message, detail }],
        meta: { timestamp: new Date().toISOString() },
      };
    }

    const errorMessage =
      exception instanceof Error ? exception.message : 'Unknown error';
    return {
      status: {
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal Server Error',
      },
      errors: [
        {
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          title: 'An unexpected error occurred',
          detail: errorMessage,
        },
      ],
      meta: { timestamp: new Date().toISOString() },
    };
  }

  private isRpcErrorPayload(obj: unknown): obj is IRpcErrorPayload {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }
    const candidate = obj as Record<string, unknown>;
    return (
      typeof candidate['status'] === 'object' &&
      candidate['status'] !== null &&
      'code' in (candidate['status'] as Record<string, unknown>) &&
      'message' in (candidate['status'] as Record<string, unknown>) &&
      Array.isArray(candidate['errors']) &&
      typeof candidate['meta'] === 'object'
    );
  }
}
