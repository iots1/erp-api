import { timingSafeEqual } from 'crypto';

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_ACCESS_KEY_ROUTE_KEY } from '@lib/common/decorators/use-access-key.decorator';
import { SKIP_CSRF_CHECK_KEY } from '@lib/common/decorators/skip-csrf-check.decorator';
import { IAuthenticatedRequest } from '@lib/common/guards/auth.guard';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF check for the cookie-based auth flow (see
 * auth-cookie.util.ts): any mutating request carrying a `csrf_token` cookie —
 * the signal that this browser holds an ambient, auto-sent credential — must
 * echo that same value back as the `x-csrf-token` header. Deliberately keyed
 * off cookie *presence*, not `@Public()`/`request.authViaCookie`: `POST
 * /auth/refresh` is `@Public()` (no JWT required) but becomes cookie-ambient
 * the moment `refresh_token` is a cookie, so it still needs protecting.
 * Bearer-only clients never receive this cookie and are naturally exempt, as
 * are `@UseAccessKey()` (HMAC, not cookie-based) routes and `@SkipCsrfCheck()`
 * routes (only `POST /auth/login`, which predates any csrf cookie).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<IAuthenticatedRequest>();
    if (SAFE_METHODS.has(request.method)) return true;

    const isAccessKeyRoute = this.reflector.getAllAndOverride<boolean>(
      IS_ACCESS_KEY_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isAccessKeyRoute) return true;

    const skipCsrfCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_CSRF_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipCsrfCheck) return true;

    const cookieToken = request.cookies?.csrf_token;
    if (!cookieToken) return true;

    const headerToken = request.headers['x-csrf-token'];
    if (
      typeof headerToken !== 'string' ||
      !this.tokensMatch(cookieToken, headerToken)
    ) {
      throw new ForbiddenException('Missing or invalid CSRF token.');
    }

    return true;
  }

  private tokensMatch(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) return false;
    return timingSafeEqual(bufferA, bufferB);
  }
}
