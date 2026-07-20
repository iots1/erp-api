import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

import type { FastifyRequest } from 'fastify';

import { IS_PUBLIC_KEY } from '@lib/common/decorators/public.decorator';
import { IS_ACCESS_KEY_ROUTE_KEY } from '@lib/common/decorators/use-access-key.decorator';
import { IUserSession } from '@lib/common/interfaces/auth.interface';
import { SessionStoreService } from '@lib/common/services/session-store.service';

/** JWT claims only — identity + token id. Roles/permissions live in the Redis
 * session blob (see {@link SessionStoreService}), not the token itself. */
interface IAccessTokenPayload {
  sub: string;
  username: string;
  fullname: string | null;
  email: string | null;
  jti: string;
}

export interface IAuthenticatedRequest extends FastifyRequest {
  user?: {
    user_session: IUserSession;
    conditional_permissions: string[];
  };
}

/**
 * Verifies the JWT access token (signature + expiry) and checks the Redis session
 * key so revoked/logged-out tokens are rejected even before expiry. Populates
 * `request.user.user_session` per the contract `@CurrentUser()` expects.
 *
 * Skips non-HTTP contexts (TCP `@MessagePattern` handlers) and routes marked `@Public()`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly sessionStore: SessionStoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isAccessKeyRoute = this.reflector.getAllAndOverride<boolean>(
      IS_ACCESS_KEY_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    // Access Key/Secret Key auth (system-to-system) is verified by AccessKeyGuard,
    // which runs immediately after this guard in the global APP_GUARD chain and
    // populates `request.user` itself — skip the JWT check for these routes.
    if (isAccessKeyRoute) return true;

    const request = context.switchToHttp().getRequest<IAuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing access token.');
    }

    let payload: IAccessTokenPayload;
    try {
      payload = this.jwtService.verify<IAccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    const session = await this.sessionStore.get(payload.jti);
    if (!session) {
      throw new UnauthorizedException(
        'Session has been revoked. Please log in again.',
      );
    }

    request.user = {
      user_session: {
        id: payload.sub,
        username: session.username,
        fullname: session.fullname,
        email: session.email,
        roles: session.roles,
        permissions: session.permissions,
        jti: payload.jti,
      },
      conditional_permissions: session.conditional_permissions ?? [],
    };

    return true;
  }

  private extractToken(request: FastifyRequest): string | null {
    const header = request.headers['authorization'];
    if (typeof header !== 'string') return null;
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token : null;
  }
}
