import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { IRpcErrorPayload } from './rpc-exceptions-filter.util';

/**
 * Re-throws an RPC error received from a TCP microservice as the appropriate
 * NestJS {@link HttpException} so the HTTP-facing {@link AllExceptionsFilter}
 * can serialise it correctly.
 *
 * Without this helper, errors coming back from `ClientProxy.send()` are plain
 * `Error` / `RpcException` objects that the HTTP filter treats as catch-all
 * 500 Internal Server Errors.
 */
export function handleRpcError(error: unknown): never {
  const payload = extractRpcPayload(error);

  if (payload) {
    const { code, message } = payload.status;
    const detail = payload.errors?.[0]?.detail ?? message;

    throw httpExceptionFor(code, detail, message);
  }

  // Transport-level / timeout errors — IAM is unreachable
  const msg = error instanceof Error ? error.message : String(error);
  throw new ServiceUnavailableException(`Upstream service unavailable: ${msg}`);
}

// ──────────────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────────────

function extractRpcPayload(error: unknown): IRpcErrorPayload | null {
  if (isRpcErrorPayload(error)) {
    return error;
  }

  // NestJS Microservice wraps the error in an object whose `.error` property
  // holds the original payload, and `.message` is a string like "...".
  if (isRpcErrorPayloadLike(error)) {
    return error.error;
  }

  return null;
}

function isRpcErrorPayload(obj: unknown): obj is IRpcErrorPayload {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Record<string, unknown>).status === 'object' &&
    (obj as Record<string, unknown>).status !== null &&
    'code' in
      ((obj as Record<string, unknown>).status as Record<string, unknown>) &&
    'message' in
      ((obj as Record<string, unknown>).status as Record<string, unknown>) &&
    Array.isArray((obj as Record<string, unknown>).errors) &&
    typeof (obj as Record<string, unknown>).meta === 'object'
  );
}

function isRpcErrorPayloadLike(
  obj: unknown,
): obj is { error: IRpcErrorPayload; message: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'error' in obj &&
    'message' in obj &&
    isRpcErrorPayload((obj as Record<string, unknown>).error)
  );
}

function httpExceptionFor(
  code: HttpStatus,
  detail: string,
  message: string,
): HttpException {
  switch (code) {
    case HttpStatus.BAD_REQUEST:
      return new BadRequestException(detail);
    case HttpStatus.UNAUTHORIZED:
      return new UnauthorizedException(detail);
    case HttpStatus.FORBIDDEN:
      return new ForbiddenException(detail);
    case HttpStatus.NOT_FOUND:
      return new NotFoundException(detail);
    case HttpStatus.CONFLICT:
      return new ConflictException(detail);
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return new UnprocessableEntityException(detail);
    default: {
      const numericCode: number = code;
      return new HttpException(
        { message, detail },
        numericCode >= 400 && numericCode < 500
          ? code
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
