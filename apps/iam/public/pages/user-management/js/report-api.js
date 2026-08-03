// JSON:API client for report-bc — same factory as api.js (iam-bc), pointed at
// window.__REPORT_API_BASE__. Used by the print-templates and document-types
// admin pages, which are hosted in iam's views but manage resources owned by
// report-bc's own database. Auth still works cross-BC unmodified: the same
// access_token cookie + AuthGuard/PermissionGuard pair report-bc registers
// globally (see CLAUDE.md) validate it exactly like iam-bc does.
import { createJsonApiClient } from './json-api-client.js';

const client = createJsonApiClient({ getBaseUrl: () => window.__REPORT_API_BASE__ });

export const reportGet = client.get;
export const reportPost = client.post;
export const reportPut = client.put;
export const reportDelete = client.del;
/** Like reportPost, but for endpoints returning a raw binary body (e.g. a
 * Gotenberg-rendered PDF) instead of a JSON:API envelope — resolves to a Blob. */
export const reportPostBlob = client.postBlob;
