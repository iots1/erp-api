import type { FastifyReply } from 'fastify';

import { ConfigService } from '@lib/config';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const CSRF_TOKEN_COOKIE = 'csrf_token';

export interface IAuthCookiesToSet {
  access_token: string;
  refresh_token: string;
  csrf_token: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  /** Scopes the refresh-token cookie to auth-bc's own route prefix (e.g. `/auth/v1`)
   * — least privilege, since only auth-bc's refresh/logout handlers read it. */
  refreshCookiePath: string;
}

function baseCookieOptions(configService: ConfigService) {
  return {
    httpOnly: true,
    secure: configService.get<boolean>('COOKIE_SECURE') ?? true,
    sameSite: 'lax' as const,
    domain: configService.get<string>('COOKIE_DOMAIN') || undefined,
  };
}

/** Sets the three cookies that back the browser auth flow: httpOnly access/refresh
 * token cookies, plus a JS-readable CSRF token cookie (double-submit pattern —
 * see CsrfGuard). Centralized here so every issuer (login/refresh) and the
 * clearer (logout) agree on attributes; a mismatch between set/clear attributes
 * makes browsers silently fail to delete a cookie. */
export function setAuthCookies(
  reply: FastifyReply,
  configService: ConfigService,
  cookies: IAuthCookiesToSet,
): void {
  const base = baseCookieOptions(configService);

  reply.setCookie(ACCESS_TOKEN_COOKIE, cookies.access_token, {
    ...base,
    path: '/',
    maxAge: cookies.accessTtlSeconds,
  });
  reply.setCookie(REFRESH_TOKEN_COOKIE, cookies.refresh_token, {
    ...base,
    path: cookies.refreshCookiePath,
    maxAge: cookies.refreshTtlSeconds,
  });
  reply.setCookie(CSRF_TOKEN_COOKIE, cookies.csrf_token, {
    ...base,
    httpOnly: false,
    path: '/',
    maxAge: cookies.accessTtlSeconds,
  });
}

export function clearAuthCookies(
  reply: FastifyReply,
  configService: ConfigService,
  refreshCookiePath: string,
): void {
  const base = baseCookieOptions(configService);

  reply.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: '/' });
  reply.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...base,
    path: refreshCookiePath,
  });
  reply.clearCookie(CSRF_TOKEN_COOKIE, {
    ...base,
    httpOnly: false,
    path: '/',
  });
}
