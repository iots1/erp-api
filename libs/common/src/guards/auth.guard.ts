import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

import Redis from 'ioredis';
import type { FastifyRequest } from 'fastify';

import { IS_PUBLIC_KEY } from '@lib/common/decorators/public.decorator';
import { RedisService } from '@lib/common/enum/app-microservice.enum';
import { IUserSession } from '@lib/common/interfaces/auth.interface';

interface IAccessTokenPayload {
  sub: string;
  username: string;
  fullname: string | null;
  email: string;
  roles: string[];
  permissions: string[];
  conditional_permissions: string[];
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
    @Inject(RedisService.name) private readonly redisClient: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

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

    const sessionExists = await this.redisClient.exists(
      `session:${payload.jti}`,
    );
    if (sessionExists === 0) {
      throw new UnauthorizedException(
        'Session has been revoked. Please log in again.',
      );
    }

    request.user = {
      user_session: {
        id: payload.sub,
        username: payload.username,
        fullname: payload.fullname,
        email: payload.email,
        roles: payload.roles,
        permissions: payload.permissions,
        jti: payload.jti,
      },
      conditional_permissions: payload.conditional_permissions ?? [],
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
