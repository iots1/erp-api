/** Pagination metadata returned with paginated collections. */
export interface IPagination {
  page: number;
  page_size: number;
  total: number;
  total_records: number;
  total_pages: number;
}

/** Generic paginated result shape ({ data, pagination }). */
export interface IPaginatedResult<T> {
  data: T[];
  pagination: IPagination;
}
