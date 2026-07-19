// fetchWithAuth: the only way pages should call an authenticated API. Injects
// the bearer token, retries once through a token refresh on 401, and — if the
// refresh itself fails (refresh token expired/revoked) — surfaces the shared
// #authLoginModal instead of silently failing. See SKILL.md "Auth Pattern".
import {
  clearSession,
  getAccessToken,
  login,
  refreshAccessToken,
} from './login.service.js';
import { closeModal, openModal } from './modal.service.js';

let pendingRefresh = null;

export async function fetchWithAuth(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response = await fetch(url, { ...options, headers });
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

  const retryHeaders = new Headers(options.headers || {});
  retryHeaders.set('Authorization', `Bearer ${getAccessToken()}`);
  return fetch(url, { ...options, headers: retryHeaders });
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
