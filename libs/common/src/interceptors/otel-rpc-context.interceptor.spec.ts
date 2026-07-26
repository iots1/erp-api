import { CallHandler, ExecutionContext } from '@nestjs/common';

import {
  context as otelContext,
  propagation,
  trace,
  SpanStatusCode,
} from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  InMemorySpanExporter,
  ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  firstValueFrom,
  lastValueFrom,
  Observable,
  of,
  throwError,
} from 'rxjs';

import { OtelRpcContextInterceptor } from './otel-rpc-context.interceptor';

/**
 * Real OpenTelemetry provider/exporter/propagator/context-manager — not
 * mocks — so the assertions below prove an actual parent/child span
 * relationship, the same way `otel-rpc-context.interceptor.spec.ts` is
 * tested in the sibling `meditech-api` fix this port is based on.
 */
const exporter = new InMemorySpanExporter();
let provider: NodeTracerProvider;
let contextManager: AsyncLocalStorageContextManager;

beforeAll(() => {
  provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  contextManager = new AsyncLocalStorageContextManager();
  contextManager.enable();

  trace.setGlobalTracerProvider(provider);
  otelContext.setGlobalContextManager(contextManager);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
});

afterAll(async () => {
  otelContext.disable();
  trace.disable();
  propagation.disable();
  contextManager.disable();
  await provider.shutdown();
});

beforeEach(() => {
  exporter.reset();
});

function buildHandler<T>(observable: Observable<T>): CallHandler {
  return { handle: () => observable } as CallHandler;
}

function buildRpcContext(data: unknown): ExecutionContext {
  return {
    getType: () => 'rpc',
    switchToRpc: () => ({ getData: () => data }),
    getClass: () => ({ name: 'FooController' }),
    getHandler: () => ({ name: 'bar' }),
  } as unknown as ExecutionContext;
}

function buildHttpContext(): ExecutionContext {
  return { getType: () => 'http' } as unknown as ExecutionContext;
}

/** Runs `fn` with a real, currently-active span so its traceparent can be
 * injected into a carrier — simulating the sender side
 * (`MicroserviceClientService.createCallContext()`). */
function withSenderSpan<T>(
  fn: (
    carrier: Record<string, string>,
    senderSpanId: string,
    traceId: string,
  ) => T,
): T {
  const tracer = trace.getTracer('test-sender');
  return tracer.startActiveSpan('sender-span', (span) => {
    const carrier: Record<string, string> = {};
    propagation.inject(otelContext.active(), carrier);
    const { spanId, traceId } = span.spanContext();
    try {
      return fn(carrier, spanId, traceId);
    } finally {
      span.end();
    }
  });
}

function findSpan(name: string): ReadableSpan {
  const span = exporter.getFinishedSpans().find((s) => s.name === name);
  if (!span) throw new Error(`span "${name}" not found`);
  return span;
}

describe('OtelRpcContextInterceptor', () => {
  const interceptor = new OtelRpcContextInterceptor();

  it('is a no-op for HTTP context — passes next.handle() straight through', async () => {
    const source = of({ ok: true });
    const result = await lastValueFrom(
      interceptor.intercept(buildHttpContext(), buildHandler(source)),
    );

    expect(result).toEqual({ ok: true });
    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });

  it('extracts _context.otel and starts a span that is a child of the sender span', async () => {
    await withSenderSpan(async (carrier, senderSpanId, traceId) => {
      const rpcContext = buildRpcContext({
        payload: {},
        _context: { otel: carrier },
      });

      await lastValueFrom(
        interceptor.intercept(rpcContext, buildHandler(of({ ok: true }))),
      );

      const span = findSpan('FooController.bar');
      expect(span.spanContext().traceId).toBe(traceId);
      expect(span.parentSpanContext?.spanId).toBe(senderSpanId);
      expect(span.status.code).not.toBe(SpanStatusCode.ERROR);
    });
  });

  it('propagates the emitted value unchanged', async () => {
    const carrier: Record<string, string> = {};
    const rpcContext = buildRpcContext({
      payload: {},
      _context: { otel: carrier },
    });

    const result = await firstValueFrom(
      interceptor.intercept(rpcContext, buildHandler(of({ hello: 'world' }))),
    );

    expect(result).toEqual({ hello: 'world' });
  });

  it('no _context.otel present: still creates a root span (backward compatible)', async () => {
    const rpcContext = buildRpcContext({ payload: {} });

    await lastValueFrom(
      interceptor.intercept(rpcContext, buildHandler(of({ ok: true }))),
    );

    const span = findSpan('FooController.bar');
    expect(span.parentSpanContext).toBeUndefined();
  });

  it('malformed payload (no _context at all) does not break the call', async () => {
    const rpcContext = buildRpcContext(null);

    const result = await lastValueFrom(
      interceptor.intercept(rpcContext, buildHandler(of({ ok: true }))),
    );

    expect(result).toEqual({ ok: true });
    const span = findSpan('FooController.bar');
    expect(span.parentSpanContext).toBeUndefined();
  });

  it('handler error path: span gets ERROR status + exception event, error still propagates', async () => {
    const rpcContext = buildRpcContext({ payload: {} });
    const boom = new Error('handler exploded');

    await expect(
      lastValueFrom(
        interceptor.intercept(rpcContext, buildHandler(throwError(() => boom))),
      ),
    ).rejects.toBe(boom);

    const span = findSpan('FooController.bar');
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.events.some((e) => e.name === 'exception')).toBe(true);
  });
});
