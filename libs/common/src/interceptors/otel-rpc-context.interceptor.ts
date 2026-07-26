import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import {
  context as otelContext,
  propagation,
  ROOT_CONTEXT,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { Observable, catchError, finalize } from 'rxjs';

import { ICallContext } from '@lib/common/modules/log/interfaces/log-context.interface';

const TRACER_NAME = 'erp-rpc';

/**
 * Bridges the real OpenTelemetry span tree across a TCP/RMQ
 * `@MessagePattern`/`@EventPattern` hop.
 *
 * `APP_INTERCEPTOR` (and `APP_GUARD`/`APP_PIPE`/`APP_FILTER`) never run for
 * RPC handlers in this codebase: `app.connectMicroservice()` — called
 * without `{ inheritAppConfig: true }` in `setupMicroservice()`
 * (bootstrap.util.ts) on purpose, since inheriting would also drag in
 * `AuthGuard`/`ValidationPipe`/etc. and start rejecting internal
 * service-to-service calls that never carry a JWT — builds the microservice
 * against a brand-new, empty `ApplicationConfig`. Providers registered via
 * `APP_*` tokens are only ever written into the *main* HTTP app's
 * `ApplicationConfig`, once, when Nest scans the module tree at
 * `NestFactory.create()`; they are never copied into a microservice
 * instance's separate config. So this interceptor is registered directly on
 * the microservice instance instead, via `.useGlobalInterceptors()`
 * (`setupMicroservice()`) — which is also why it must stay a stateless
 * singleton (no request-scoped deps): `.useGlobalInterceptors()` does not
 * resolve request-scoped providers the way `APP_INTERCEPTOR` does.
 *
 * On the sending side, `MicroserviceClientService.createCallContext()`
 * injects the caller's active span into `_context.otel` (a W3C
 * `traceparent`/`tracestate` carrier — separate from the hand-rolled
 * `trace` fields used for log correlation). This interceptor extracts it
 * back out and opens a child span *before* calling `next.handle()`; the
 * pg/ioredis auto-instrumentation already patched into the process (see
 * `tracing.ts`) then attaches every DB query the handler makes as a child
 * of that span automatically, with zero per-handler code, because the
 * active OTel context propagates through the async continuations spawned
 * from this synchronous call (Node's `AsyncLocalStorage` follows the async
 * chain regardless of when the resulting Observable is subscribed to).
 */
@Injectable()
export class OtelRpcContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const carrier = this.extractCarrier(context);
    const parentContext = carrier
      ? propagation.extract(ROOT_CONTEXT, carrier)
      : ROOT_CONTEXT;

    const spanName = this.resolveSpanName(context);
    const span = trace
      .getTracer(TRACER_NAME)
      .startSpan(spanName, {}, parentContext);
    const activeContext = trace.setSpan(parentContext, span);

    return otelContext
      .with(activeContext, () => next.handle())
      .pipe(
        catchError((err: unknown) => {
          span.recordException(
            err instanceof Error ? err : new Error(String(err)),
          );
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw err;
        }),
        finalize(() => span.end()),
      );
  }

  /** `ControllerName.handlerName`, mirroring the naming NestJS's own HTTP
   * auto-instrumentation (`instrumentation-nestjs-core`) uses for
   * controller-method spans, so RPC and HTTP spans read consistently in
   * Tempo/Jaeger. */
  private resolveSpanName(context: ExecutionContext): string {
    return `${context.getClass().name}.${context.getHandler().name}`;
  }

  /** Never let a malformed/missing `_context.otel` (e.g. a caller on an
   * older build, or tracing disabled at the sender) break the RPC call —
   * fall back to starting a fresh root span instead. */
  private extractCarrier(
    context: ExecutionContext,
  ): Record<string, string> | undefined {
    try {
      const data = context
        .switchToRpc()
        .getData<{ _context?: ICallContext } | null | undefined>();
      const otelCarrier = data?._context?.otel;
      return otelCarrier && typeof otelCarrier === 'object'
        ? otelCarrier
        : undefined;
    } catch {
      return undefined;
    }
  }
}
