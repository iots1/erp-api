// JSON:API client for the auth-bc admin endpoints (login-histories, sessions)
// — same factory as api.js (iam-bc), but auth-bc lives on a different origin
// (window.__AUTH_CONFIG__.baseUrl, the same cross-origin pattern
// login.service.js already uses for /auth/login etc.), so it resolves its base
// URL from there instead.
import { createJsonApiClient } from './json-api-client.js';

const client = createJsonApiClient({ getBaseUrl: () => window.__AUTH_CONFIG__.baseUrl });

export const authAdminGet = client.get;
export const authAdminDelete = client.del;
