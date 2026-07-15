import type { IErrorSource } from './error-source.interface';

export interface IErrorObject {
  code?: string;
  title?: string;
  detail?: string;
  source?: IErrorSource;
  meta?: { trace_id: string };
  field?: string;
  message?: string;
}
