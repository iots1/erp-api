// Thin JSON:API client for report-bc — same shape as api.js (iam-bc), but
// pointed at window.__REPORT_API_BASE__. Used by the print-templates admin
// page, which is hosted in iam's views but manages a resource owned by
// report-bc's own database. Auth still works cross-BC unmodified: the same
// access_token cookie + AuthGuard/PermissionGuard pair report-bc registers
// globally (see CLAUDE.md) validate it exactly like iam-bc does.
import { fetchWithAuth } from '../../../js/auth-guard.service.js';

function flattenResource(resource) {
  if (!resource || typeof resource !== 'object') return resource;
  const { id, attributes } = resource;
  return { id, ...(attributes ?? {}) };
}

function unwrapEnvelope(json) {
  if (json && typeof json === 'object' && 'data' in json) {
    if (Array.isArray(json.data)) {
      return {
        items: json.data.map(flattenResource),
        pagination: json.meta?.pagination ?? null,
      };
    }
    return flattenResource(json.data);
  }
  return json;
}

async function toApiError(response) {
  try {
    const json = await response.json();
    const first = json.errors?.[0];
    const error = new Error(first?.detail ?? first?.title ?? response.statusText);
    error.status = response.status;
    error.errors = json.errors ?? [];
    return error;
  } catch {
    const error = new Error(response.statusText || 'Request failed');
    error.status = response.status;
    return error;
  }
}

function buildUrl(path, query) {
  const base = window.__REPORT_API_BASE__;
  let url = `${base}${path}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request(path, { method = 'GET', body, query } = {}) {
  const response = await fetchWithAuth(buildUrl(path, query), {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;
  if (!response.ok) throw await toApiError(response);

  const json = await response.json();
  return unwrapEnvelope(json);
}

export const reportGet = (path, query) => request(path, { query });
export const reportPost = (path, body) => request(path, { method: 'POST', body });
export const reportPut = (path, body) => request(path, { method: 'PUT', body });
export const reportDelete = (path) => request(path, { method: 'DELETE' });
