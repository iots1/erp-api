import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ContextIdFactory, ModuleRef, Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';

import type { FastifyRequest } from 'fastify';

import {
  IamMessagePatterns,
  IEvaluateConditionsPayload,
} from '@lib/common/constants/iam-message-patterns';
import { IS_PUBLIC_KEY } from '@lib/common/decorators/public.decorator';
import { REQUIRE_PERMISSION_KEY } from '@lib/common/decorators/require-permission.decorator';
import { AppMicroservice } from '@lib/common/enum/app-microservice.enum';
import { NoOpLogsService } from '@lib/common/modules/log/logs.service';
import { MicroserviceClientService } from '@lib/common/services/microservice-client.service';

import { IAuthenticatedRequest } from './auth.guard';

/**
 * Enforces `@RequirePermission('resource:action')`. Fast path checks the JWT's flat
 * `permissions` list (already deny-override-resolved at login). Permissions requiring
 * ABAC conditions are re-evaluated against iam-bc at request time via
 * {@link IamMessagePatterns.EvaluateConditions} — conditions depend on request context
 * (owner, time, IP) that cannot be baked into the JWT at login.
 *
 * Default-deny: a non-public route without `@RequirePermission` is rejected.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
    @Inject(AppMicroservice.Iam.name) private readonly iamClient: ClientProxy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      throw new ForbiddenException(
        'This endpoint is missing @RequirePermission() — default deny.',
      );
    }

    const request = context.switchToHttp().getRequest<IAuthenticatedRequest>();
    const session = request.user?.user_session;
    if (!session?.id) {
      throw new ForbiddenException('Not authenticated.');
    }

    if (session.permissions.includes(required)) return true;

    const conditionalPermissions = request.user?.conditional_permissions ?? [];
    if (conditionalPermissions.includes(required)) {
      const [resource, action] = required.split(':');
      const contextId = ContextIdFactory.getByRequest(request);
      const microserviceClient = await this.moduleRef.resolve(
        MicroserviceClientService,
        contextId,
        { strict: false },
      );
      const allowed = await microserviceClient.sendWithContext<
        boolean,
        IEvaluateConditionsPayload
      >(
        new NoOpLogsService(),
        this.iamClient,
        { cmd: IamMessagePatterns.EvaluateConditions },
        {
          user_id: session.id,
          service: '*',
          resource,
          action,
          context: this.buildEvaluationContext(request),
        },
        false,
      );
      if (allowed) return true;
    }

    throw new ForbiddenException(`Missing required permission: ${required}`);
  }

  /** Best-effort request context for ABAC condition keys (e.g. owner_id, current_time). */
  private buildEvaluationContext(
    request: FastifyRequest,
  ): Record<string, string> {
    const now = new Date();
    const context: Record<string, string> = {
      'context.current_time': `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      'context.ip': request.ip ?? '',
    };

    const flatten = (source: Record<string, unknown> | undefined): void => {
      if (!source) return;
      for (const [key, value] of Object.entries(source)) {
        if (
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean'
        ) {
          context[key] = String(value);
        }
      }
    };

    flatten(request.params as Record<string, unknown>);
    flatten(request.query as Record<string, unknown>);
    flatten(request.body as Record<string, unknown>);

    return context;
  }
}
