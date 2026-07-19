import { showApiError } from './toast.service.js';

/** Wraps the "force-refresh a reference-data list, then re-render" pattern
 * every list page (roles, policies, ...) repeated: fetch, render on success,
 * toast + log on failure. SRP: owns only that error-handling wrapper, not
 * the fetch or render themselves — callers stay in control of both. */
export async function loadList(ensureLoaded, render, errorMessage) {
  try {
    await ensureLoaded();
    render();
  } catch (error) {
    showApiError(error, errorMessage);
  }
}
