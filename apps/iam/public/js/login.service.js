// Session/token state, shared by every page. Talks to auth-bc (cross-origin —
// see window.__AUTH_CONFIG__.baseUrl, injected by each page's config.ejs).
// Persisted to localStorage so a refresh doesn't force a re-login.

const STORAGE_KEY = 'iam_view.session.v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { access_token: null, refresh_token: null, user: null };
    const parsed = JSON.parse(raw);
    return {
      access_token: parsed.access_token ?? null,
      refresh_token: parsed.refresh_token ?? null,
      user: parsed.user ?? null,
    };
  } catch {
    return { access_token: null, refresh_token: null, user: null };
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
export function getAccessToken() {
  return state.access_token;
}
export function getRefreshToken() {
  return state.refresh_token;
}
export function getCurrentUser() {
  return state.user;
}
export function isAuthenticated() {
  return Boolean(state.access_token && state.user);
}
export function hasPermission(permission) {
  return (state.user?.permissions ?? []).includes(permission);
}

export function setTokens({ access_token, refresh_token }) {
  state = { ...state, access_token, refresh_token };
  persist();
  emit();
}

export function setUser(user) {
  state = { ...state, user };
  persist();
  emit();
}

export function clearSession() {
  state = { access_token: null, refresh_token: null, user: null };
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw await toApiError(response);
  const tokens = await response.json();
  setTokens({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });

  const meResponse = await fetch(`${authBase()}/auth/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!meResponse.ok) throw await toApiError(meResponse);
  const user = await meResponse.json();
  setUser(user);
  return user;
}

export async function logout() {
  const { access_token, refresh_token } = state;
  try {
    await fetch(`${authBase()}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(access_token ? { Authorization: `Bearer ${access_token}` } : {}),
      },
      body: JSON.stringify(refresh_token ? { refresh_token } : {}),
    });
  } finally {
    clearSession();
  }
}

export async function refreshAccessToken() {
  if (!state.refresh_token) throw new Error('No refresh token');
  const response = await fetch(`${authBase()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: state.refresh_token }),
  });
  if (!response.ok) throw await toApiError(response);
  const tokens = await response.json();
  setTokens({ access_token: tokens.access_token, refresh_token: tokens.refresh_token });
  return tokens;
}
