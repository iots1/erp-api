import { ICallContext } from '@lib/common/modules/log/interfaces/log-context.interface';

/**
 * Standardized payload wrapper for microservice messages.
 * Combines the actual data payload with call context for tracing and user identity propagation.
 */
export interface IMicroservicePayload<T = unknown> {
  payload: T;
  _context: ICallContext;
}

/**
 * Legacy RPC error response format returned by older microservices.
 */
export interface IRpcErrorResponse {
  status_code?: number;
  statusCode?: number;
  message?: string;
  error?: string;
}
