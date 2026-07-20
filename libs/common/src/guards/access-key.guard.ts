import * as crypto from 'crypto';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ContextIdFactory, ModuleRef, Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';

import type { FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';

import {
  IamMessagePatterns,
  IVerifyAccessKeySignaturePayload,
  IVerifyAccessKeySignatureResponse,
} from '@lib/common/constants/iam-message-patterns';
import { IS_ACCESS_KEY_ROUTE_KEY } from '@lib/common/decorators/use-access-key.decorator';
import {
  AppMicroservice,
  RedisService,
} from '@lib/common/enum/app-microservice.enum';
import { NoOpLogsService } from '@lib/common/modules/log/logs.service';
import { MicroserviceClientService } from '@lib/common/services/microservice-client.service';

import { IAuthenticatedRequest } from './auth.guard';

const ACCESS_KEY_ID_PATTERN = /^AKIA[A-Z0-9]{16}$/;
const TIMESTAMP_FRESHNESS_MS = 5 * 60 * 1000;
const FAILED_ATTEMPT_LIMIT = 5;
const FAILED_ATTEMPT_WINDOW_SECONDS = 60;
const BLOCK_DURATION_SECONDS = 15 * 60;

/**
 * Authenticates `@UseAccessKey()` routes via an Access Key/Secret Key HMAC
 * signature (system-to-system auth), as an alternative to the JWT flow.
 * No-ops on every other route — `AuthGuard` only skips its own JWT check for
 * `@UseAccessKey()` routes, so this guard is the one that actually populates
 * `request.user` for them before `PermissionGuard` runs.
 */
@Injectable()
export class AccessKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
    @Inject(RedisService.name) private readonly redis: Redis,
    @Inject(AppMicroservice.Iam.name) private readonly iamClient: ClientProxy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isAccessKeyRoute = this.reflector.getAllAndOverride<boolean>(
      IS_ACCESS_KEY_ROUTE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!isAccessKeyRoute) return true;

    const request = context.switchToHttp().getRequest<IAuthenticatedRequest>();

    const accessKeyId = request.headers['x-access-key-id'];
    const timestamp = request.headers['x-timestamp'];
    const signature = request.headers['x-signature'];

    if (
      typeof accessKeyId !== 'string' ||
      typeof timestamp !== 'string' ||
      typeof signature !== 'string'
    ) {
      throw new UnauthorizedException(
        'Missing required headers: X-Access-Key-Id, X-Timestamp, X-Signature',
      );
    }

    if (!ACCESS_KEY_ID_PATTERN.test(accessKeyId)) {
      throw new UnauthorizedException('Invalid Access Key ID format');
    }

    if (!this.isTimestampFresh(timestamp)) {
      throw new UnauthorizedException(
        'Request timestamp is too old or in the future',
      );
    }

    const isBlocked = await this.redis.get(`access_key_blocked:${accessKeyId}`);
    if (isBlocked) {
      throw new UnauthorizedException(
        'Access Key is temporarily blocked due to repeated failed attempts',
      );
    }

    const stringToSign = this.buildStringToSign(request, timestamp);
    const sourceIp = this.getClientIp(request);

    const payload: IVerifyAccessKeySignaturePayload = {
      access_key_id: accessKeyId,
      string_to_sign: stringToSign,
      provided_signature: signature,
      source_ip: sourceIp,
    };

    const contextId = ContextIdFactory.getByRequest(request);
    const microserviceClient = await this.moduleRef.resolve(
      MicroserviceClientService,
      contextId,
      { strict: false },
    );

    const result = await microserviceClient.sendWithContext<
      IVerifyAccessKeySignatureResponse,
      IVerifyAccessKeySignaturePayload
    >(
      new NoOpLogsService(),
      this.iamClient,
      { cmd: IamMessagePatterns.VerifyAccessKeySignature },
      payload,
      null,
    );

    if (!result?.valid || !result.context) {
      await this.incrementFailedAttempts(accessKeyId);
      throw new UnauthorizedException(result?.reason ?? 'Unauthorized');
    }

    await this.redis.del(`access_key_failed:${accessKeyId}`);

    request.user = {
      user_session: {
        id: result.context.owner_id,
        username: result.context.access_key_id,
        fullname: result.context.name,
        email: null,
        roles: [],
        permissions: result.context.permissions,
        jti: null,
      },
      conditional_permissions: result.context.conditional_permissions,
    };

    return true;
  }

  private buildStringToSign(
    request: FastifyRequest & { rawBody?: Buffer },
    timestamp: string,
  ): string {
    const method = request.method.toUpperCase();
    const path = request.url.split('?')[0];
    const rawBody = request.rawBody;
    const bodyString =
      rawBody !== undefined && rawBody.length > 0
        ? rawBody.toString('utf-8')
        : '';
    const bodyHash = crypto
      .createHash('sha256')
      .update(bodyString)
      .digest('hex');
    return `${method}\n${path}\n${timestamp}\n${bodyHash}`;
  }

  private isTimestampFresh(timestamp: string): boolean {
    const parsed = Date.parse(timestamp);
    if (Number.isNaN(parsed)) return false;
    return Math.abs(Date.now() - parsed) <= TIMESTAMP_FRESHNESS_MS;
  }

  private getClientIp(request: FastifyRequest): string | null {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return request.ip ?? null;
  }

  private async incrementFailedAttempts(accessKeyId: string): Promise<void> {
    const counterKey = `access_key_failed:${accessKeyId}`;
    const blockKey = `access_key_blocked:${accessKeyId}`;
    const attempts = await this.redis.incr(counterKey);
    await this.redis.expire(counterKey, FAILED_ATTEMPT_WINDOW_SECONDS);
    if (attempts >= FAILED_ATTEMPT_LIMIT) {
      await this.redis.setex(blockKey, BLOCK_DURATION_SECONDS, '1');
    }
  }
}
