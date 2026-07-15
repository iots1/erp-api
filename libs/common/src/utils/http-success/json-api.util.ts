import { HttpStatus } from '@nestjs/common';

import type { IJsonApiResponse } from '@lib/common/interfaces/response/json-api-response.interface';
import type { ILinks } from '@lib/common/interfaces/response/links.interface';
import type { IMeta } from '@lib/common/interfaces/response/meta.interface';
import type { IPagination } from '@lib/common/interfaces/response/pagination.interface';
import type { IResourceObject } from '@lib/common/interfaces/response/resource-object.interface';
import type { IStatus } from '@lib/common/interfaces/response/status.interface';

/** Builds a JSON:API response for a single resource. */
export function createSuccessResponse<T = unknown>(
  type: string,
  data: T,
  baseUrl: string,
  options?: { id?: string; meta?: IMeta; links?: ILinks; status?: IStatus },
): IJsonApiResponse<T> {
  const { id: dataId, ...attributesWithoutId } = data as Record<
    string,
    unknown
  >;

  const resource: IResourceObject<T> = {
    type,
    id: options?.id ?? (dataId as string),
    attributes: attributesWithoutId as T,
  };

  if (options?.meta) resource.meta = options.meta;
  if (options?.links) resource.links = options.links;

  return {
    data: resource,
    links: { self: baseUrl },
    meta: { timestamp: new Date() },
    status: options?.status ?? { code: 200000, message: 'Request Succeeded' },
  };
}

/** Builds a JSON:API response for a collection of resources. */
export function createSuccessCollectionResponse<T = unknown>(
  type: string,
  data: T[],
  options?: { meta?: IMeta; links?: ILinks; idField?: keyof T },
  status?: IStatus,
): IJsonApiResponse<T> {
  const resources: IResourceObject<T>[] = data.map((item, index) => {
    const { id: itemId, ...attributesWithoutId } = item as Record<
      string,
      unknown
    >;

    let finalId: string;
    if (options?.idField && item[options.idField]) {
      finalId = String(item[options.idField]);
    } else if (itemId) {
      finalId = String(itemId);
    } else {
      finalId = String(index);
    }

    return { type, id: finalId, attributes: attributesWithoutId as T };
  });

  const response: IJsonApiResponse<T> = {
    data: resources,
    meta: { timestamp: new Date() },
  };

  if (options?.links) response.links = options.links;
  if (status) response.status = status;
  if (options?.meta) {
    response.meta = { ...response.meta, ...options.meta };
  }

  return response;
}

/** Builds a paginated JSON:API collection response with navigation links. */
export function createPaginatedResponse<T = unknown>(
  type: string,
  data: T[],
  pagination: IPagination,
  baseUrl: string,
  options?: { meta?: IMeta; idField?: keyof T },
  status?: IStatus,
): IJsonApiResponse<T> {
  const { page, page_size, total_pages } = pagination;

  let links: ILinks = { self: `${baseUrl}?page=${page}&limit=${page_size}` };

  if (data.length > 0) {
    links = {
      first: `${baseUrl}?page=1&limit=${page_size}`,
      last: `${baseUrl}?page=${total_pages}&limit=${page_size}`,
      ...links,
    };
  }
  if (page > 1) links.prev = `${baseUrl}?page=${page - 1}&limit=${page_size}`;
  if (page < total_pages)
    links.next = `${baseUrl}?page=${page + 1}&limit=${page_size}`;

  const meta: IMeta = { pagination, ...options?.meta };

  return createSuccessCollectionResponse(
    type,
    data,
    { meta, links, idField: options?.idField },
    status ?? { code: 200000, message: 'Request Succeeded' },
  );
}

/** Builds a 201 Created JSON:API response with a `self` location link. */
export function createCreatedResponse<T = unknown>(
  type: string,
  data: T,
  location: string,
  baseUrl = '',
  options?: { id?: string; meta?: IMeta; links?: ILinks; status?: IStatus },
): IJsonApiResponse<T> {
  const {
    status = {
      code: Number(`${HttpStatus.CREATED}000`),
      message: 'Created successfully',
    },
    ...rest
  } = options ?? {};

  return createSuccessResponse(type, data, baseUrl, {
    ...rest,
    status,
    links: { self: location, ...rest.links },
  });
}

/** Builds an empty (204-style) JSON:API response. */
export function createNoContentResponse(): IJsonApiResponse {
  return { data: null, meta: { timestamp: new Date() } };
}
