// Session state, shared by every page. Talks to auth-bc (cross-origin — see
// window.__AUTH_CONFIG__.baseUrl, injected by each page's config.ejs).
// access_token/refresh_token are httpOnly cookies now (never touched by JS) —
// only the CSRF double-submit token and the user profile are persisted here,
// so a page refresh doesn't force a re-login.

const STORAGE_KEY = 'iam_view.session.v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { csrf_token: null, user: null };
    const parsed = JSON.parse(raw);
    return {
      csrf_token: parsed.csrf_token ?? null,
      user: parsed.user ?? null,
    };
  } catch {
    return { csrf_token: null, user: null };
  }
}

let state = loadState();
const listeners = new Set();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return state;
}
export function getCsrfToken() {
  return state.csrf_token;
}
export function getCurrentUser() {
  return state.user;
}
export function isAuthenticated() {
  return Boolean(state.csrf_token && state.user);
}
export function hasPermission(permission) {
  return (state.user?.permissions ?? []).includes(permission);
}

export function setCsrfToken(csrf_token) {
  state = { ...state, csrf_token };
  persist();
  emit();
}

export function setUser(user) {
  state = { ...state, user };
  persist();
  emit();
}

export function clearSession() {
  state = { csrf_token: null, user: null };
  localStorage.removeItem(STORAGE_KEY);
  emit();
}

/** Normalizes AllExceptionsFilter's error envelope into a plain Error. */
export async function toApiError(response) {
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

function authBase() {
  return window.__AUTH_CONFIG__.baseUrl;
}

export async function login(username, password) {
  const response = await fetch(`${authBase()}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw await toApiError(response);
  const tokens = await response.json();
  setCsrfToken(tokens.csrf_token);

  const meResponse = await fetch(`${authBase()}/auth/me`, {
    credentials: 'include',
  });
  if (!meResponse.ok) throw await toApiError(meResponse);
  const user = await meResponse.json();
  setUser(user);
  return user;
}

export async function logout() {
  const { csrf_token } = state;
  try {
    await fetch(`${authBase()}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf_token ? { 'X-CSRF-Token': csrf_token } : {}),
      },
      body: '{}',
    });
  } finally {
    clearSession();
  }
}

export async function refreshAccessToken() {
  const response = await fetch(`${authBase()}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(state.csrf_token ? { 'X-CSRF-Token': state.csrf_token } : {}),
    },
    body: '{}',
  });
  if (!response.ok) throw await toApiError(response);
  const tokens = await response.json();
  setCsrfToken(tokens.csrf_token);
  return tokens;
}
