import type { ClientProxy } from '@nestjs/microservices';

import type { Redis } from 'ioredis';
import { of } from 'rxjs';

import type {
  ICallContext,
  IMicroservicePayload,
} from '@lib/common/interfaces';
import type { ILogger } from '@lib/common/modules/log/abstracts/logger.abstract';

import { MicroserviceClientService } from './microservice-client.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Plain object (not cast to the class type) so referencing `logger.info` unbound in
 * assertions does not trip `@typescript-eslint/unbound-method`.
 */
function buildLogger(): Record<keyof ILogger, jest.Mock> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setContext: jest.fn(),
    setContextFromPayload: jest.fn(),
  };
}

/** Header bag without dash-cased object-literal keys (lint: naming-convention). */
function headers(pairs: Array<[string, string]>): Record<string, string> {
  return Object.fromEntries(pairs);
}

/** Builds a service whose injected REQUEST is `request`. Redis is never hit (no cache). */
function buildService(request: unknown): MicroserviceClientService {
  const redis = {} as Redis;
  return new MicroserviceClientService(request as Request, redis);
}

/** Mock ClientProxy that always resolves `result` and records the sent payload. */
function buildClient(result: unknown = { ok: true }): jest.Mocked<ClientProxy> {
  return {
    send: jest.fn().mockReturnValue(of(result)),
  } as unknown as jest.Mocked<ClientProxy>;
}

function sentContext(client: jest.Mocked<ClientProxy>): ICallContext {
  const payload = client.send.mock.calls[0][1] as IMicroservicePayload<unknown>;
  return payload._context;
}

describe('MicroserviceClientService — trace propagation', () => {
  const cmd = { cmd: 'get_patient' };

  it('HTTP hop: reads trace context from request headers and mints a fresh child span', async () => {
    const service = buildService({
      headers: headers([
        ['x-trace-id', 'T-root'],
        ['x-correlation-id', 'C-1'],
        ['x-span-id', 'S-http'],
        ['x-client-ip', '203.0.113.9'],
        ['x-client-user-agent', 'jest-UA'],
      ]),
      user: { user_session: { id: 'user-1', roles: ['nurse'] } },
    });
    const client = buildClient();

    await service.sendWithContext(buildLogger(), client, cmd, {
      id: '123',
    });

    const trace = sentContext(client).trace;
    expect(trace.trace_id).toBe('T-root');
    expect(trace.correlation_id).toBe('C-1');
    // the caller's span becomes our parent; we generate a brand-new span for this call
    expect(trace.parent_span_id).toBe('S-http');
    expect(trace.span_id).toMatch(UUID_RE);
    expect(trace.span_id).not.toBe('S-http');
  });

  it('chained TCP hop: falls back to inbound _context so trace_id survives B → C', async () => {
    // In an @MessagePattern handler REQUEST is the RPC payload — no headers.
    const inbound: ICallContext = {
      trace: { trace_id: 'T-root', correlation_id: 'C-1', span_id: 'S-parent' },
      user: { id: 'user-1', roles: ['nurse'] },
    };
    const service = buildService({ _context: inbound });
    const client = buildClient();

    await service.sendWithContext(buildLogger(), client, cmd, {
      id: '123',
    });

    const trace = sentContext(client).trace;
    expect(trace.trace_id).toBe('T-root'); // chain intact — the original bug
    expect(trace.correlation_id).toBe('C-1');
    expect(trace.parent_span_id).toBe('S-parent');
    expect(trace.span_id).toMatch(UUID_RE);
    expect(trace.span_id).not.toBe('S-parent');
  });

  it('no context anywhere: defaults to N/A but still mints a span', async () => {
    const service = buildService({});
    const client = buildClient();

    await service.sendWithContext(buildLogger(), client, cmd, {});

    const trace = sentContext(client).trace;
    expect(trace.trace_id).toBe('N/A');
    expect(trace.correlation_id).toBe('N/A');
    expect(trace.parent_span_id).toBeUndefined();
    expect(trace.span_id).toMatch(UUID_RE);
  });

  it('attaches trace_id + span_id to the outgoing request log', async () => {
    const service = buildService({
      headers: headers([
        ['x-trace-id', 'T-root'],
        ['x-correlation-id', 'C-1'],
        ['x-span-id', 'S-http'],
      ]),
    });
    const logger = buildLogger();

    await service.sendWithContext(logger, buildClient(), cmd, {});

    const requestLog = logger.info.mock.calls.find(([arg]) =>
      (arg as { message: string }).message.includes('[Microservice Request]'),
    );
    expect(requestLog).toBeDefined();
    const ctx = (requestLog?.[0] as { context: Record<string, unknown> })
      .context;
    expect(ctx['trace_id']).toBe('T-root');
    expect(ctx['span_id']).toMatch(UUID_RE);
    expect(ctx['correlation_id']).toBe('C-1');
  });
});
