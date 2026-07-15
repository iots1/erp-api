import { DataSource } from 'typeorm';

export class IQueryOptions {
  skipNotFound?: boolean;
  datasource?: DataSource;
}
