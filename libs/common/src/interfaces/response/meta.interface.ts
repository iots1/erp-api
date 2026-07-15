import { IPagination } from './pagination.interface';

export interface IMeta {
  pagination?: IPagination;
  timestamp?: Date;
  [key: string]: unknown;
}
