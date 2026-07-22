// fetchWithAuth: the only way pages should call an authenticated API.
// access_token is an httpOnly cookie (sent automatically) — this only injects
// the CSRF double-submit header on mutating requests, retries once through a
// token refresh on 401, and — if the refresh itself fails (refresh token
// expired/revoked) — surfaces the shared #authLoginModal instead of silently
// failing. See SKILL.md "Auth Pattern".
import {
  clearSession,
  getCsrfToken,
  login,
  refreshAccessToken,
} from './login.service.js';
import { closeModal, openModal } from './modal.service.js';

let pendingRefresh = null;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function withCsrfHeader(headers, method) {
  const merged = new Headers(headers || {});
  const csrfToken = getCsrfToken();
  if (csrfToken && !SAFE_METHODS.has((method || 'GET').toUpperCase())) {
    merged.set('X-CSRF-Token', csrfToken);
  }
  return merged;
}

export async function fetchWithAuth(url, options = {}) {
  const headers = withCsrfHeader(options.headers, options.method);
  let response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (response.status !== 401) return response;

  try {
    pendingRefresh ??= refreshAccessToken().finally(() => {
      pendingRefresh = null;
    });
    await pendingRefresh;
  } catch {
    clearSession();
    showAuthModal();
    throw new Error('Session expired — please log in again.');
  }

  const retryHeaders = withCsrfHeader(options.headers, options.method);
  return fetch(url, {
    ...options,
    headers: retryHeaders,
    credentials: 'include',
  });
}

export function showAuthModal() {
  openModal(document.getElementById('authLoginModal'));
  document.getElementById('authModalUsername')?.focus();
}

export function hideAuthModal() {
  closeModal(document.getElementById('authLoginModal'));
}

/** Bridged to window by public-api.js — bound to #authLoginForm's onsubmit. */
export async function handleAuthLogin(event) {
  event.preventDefault();
  const usernameEl = document.getElementById('authModalUsername');
  const passwordEl = document.getElementById('authModalPassword');
  const errorEl = document.getElementById('authModalError');
  errorEl.classList.add('hidden');

  try {
    await login(usernameEl.value.trim(), passwordEl.value);
    // Simplest correct recovery from an expired session: reload so every view
    // re-fetches with the new token, rather than replaying whatever request
    // triggered the 401 (which may itself be stale by now).
    window.location.reload();
  } catch (error) {
    errorEl.textContent = error.message || 'เข้าสู่ระบบไม่สำเร็จ';
    errorEl.classList.remove('hidden');
  }
}
