// JSON:API client for iam-bc. All behaviour lives in the shared factory (see
// json-api-client.js); this file only binds it to iam-bc's base URL and names
// the verbs, so call sites read `iamGet(...)` rather than `client.get(...)`.
import { createJsonApiClient } from './json-api-client.js';

const client = createJsonApiClient({ getBaseUrl: () => window.__IAM_API_BASE__ });

export const iamGet = client.get;
export const iamPost = client.post;
export const iamPut = client.put;
export const iamDelete = client.del;
