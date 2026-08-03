// Shared JSON:API client factory. Every BC this admin talks to (iam-bc,
// report-bc, auth-bc) returns the same envelope — controllers carry
// @ResourceType(), so success bodies are {data: {...}} /
// {data: [...], meta: {pagination}}, and errors are {status, errors} — so the
// unwrap/error/query-string logic is identical for all of them. Previously
// api.js, report-api.js and auth-admin-api.js each held a verbatim copy of it,
// differing only in which base URL they read.
//
// The base URL is injected as a *function*, not a string: the
// `window.__IAM_API_BASE__` / `__REPORT_API_BASE__` / `__AUTH_CONFIG__` globals
// are written by the page's config.ejs, which may run after these modules are
// evaluated. Reading it lazily per request (as the original copies did inside
// their own buildUrl) keeps that ordering irrelevant.
import { fetchWithAuth } from '../../../js/auth-guard.service.js';
import { hideLoadingOverlay, showLoadingOverlay } from './loading-overlay.service.js';

/** Verbs that mutate state — every call through these shows the shared
 * full-page overlay for the duration of the request. GET is read-only and
 * DELETE already goes through a confirm dialog (confirm-action.js), so
 * neither needs the extra "something is happening" signal. */
const OVERLAY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

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

/**
 * @param {object} options
 * @param {() => string} options.getBaseUrl Resolved per request — see note above.
 * @returns {{ get, post, put, del, postBlob, buildUrl }}
 */
export function createJsonApiClient({ getBaseUrl }) {
  function buildUrl(path, query) {
    const url = `${getBaseUrl()}${path}`;
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
    const showsOverlay = OVERLAY_METHODS.has(method);
    if (showsOverlay) showLoadingOverlay();
    try {
      const response = await fetchWithAuth(buildUrl(path, query), {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (response.status === 204) return null;
      if (!response.ok) throw await toApiError(response);

      const json = await response.json();
      return unwrapEnvelope(json);
    } finally {
      if (showsOverlay) hideLoadingOverlay();
    }
  }

  return {
    get: (path, query) => request(path, { query }),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    del: (path) => request(path, { method: 'DELETE' }),

    /** For endpoints returning a raw binary body (e.g. a PDF) instead of a
     * JSON:API envelope — resolves to a Blob. */
    postBlob: async (path, body) => {
      showLoadingOverlay();
      try {
        const response = await fetchWithAuth(buildUrl(path), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw await toApiError(response);
        return await response.blob();
      } finally {
        hideLoadingOverlay();
      }
    },
  };
}
