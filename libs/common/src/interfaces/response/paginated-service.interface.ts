import type { IPagination } from './pagination.interface';

/**
 * Shape services should return for paginated list endpoints.
 * The TransformInterceptor detects `{ data, pagination }` and renders JSON:API links/meta.
 */
export interface IPaginatedResult<T> {
  data: T[];
  pagination: IPagination;
}
