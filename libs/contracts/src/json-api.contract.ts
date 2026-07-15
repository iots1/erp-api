import type { IPagination } from './pagination.contract';

/** Status block of a JSON:API response. */
export interface IStatus {
  code: number;
  message: string;
}

export interface IResourceObject<Attributes = unknown> {
  id?: string;
  type: string;
  attributes?: Attributes;
}

export interface IJsonApiMeta {
  pagination?: IPagination;
  timestamp?: string;
  [key: string]: unknown;
}

/** Envelope returned by every ERP API endpoint (mirrors the backend TransformInterceptor). */
export interface IJsonApiResponse<Attributes = unknown> {
  status?: IStatus;
  data?: IResourceObject<Attributes> | IResourceObject<Attributes>[] | null;
  meta: IJsonApiMeta;
  links?: Record<string, string>;
}
