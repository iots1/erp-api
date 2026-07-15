import { IPagination } from '@lib/common/interfaces/response/pagination.interface';

export interface IResponsePaginatedService<T> {
  data?: T | null;
  pagination: IPagination;
}
