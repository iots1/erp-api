// Thin JSON:API client for the auth-bc admin endpoints (login-histories,
// sessions) — same envelope shape as api.js (iam-bc), but auth-bc lives on a
// different origin (window.__AUTH_CONFIG__.baseUrl, same cross-origin pattern
// login.service.js already uses for /auth/login etc.), so it needs its own
// base-URL resolution.
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
  const base = window.__AUTH_CONFIG__.baseUrl;
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
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;
  if (!response.ok) throw await toApiError(response);

  const json = await response.json();
  return unwrapEnvelope(json);
}

export const authAdminGet = (path, query) => request(path, { query });
export const authAdminDelete = (path) => request(path, { method: 'DELETE' });
