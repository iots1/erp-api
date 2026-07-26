import path from 'path';

import { trace } from '@opentelemetry/api';
import pino, { type Logger as PinoLogger } from 'pino';
import pinoHttp, { type Options as PinoHttpOptions } from 'pino-http';

import type { IUserSession } from '@lib/common/interfaces/auth.interface';

import type { HttpLoggingOptions } from './http-logging.options';

export type { HttpLoggingOptions };

// ──────────────────────────────────────────────────────────────
//  Internal types
// ──────────────────────────────────────────────────────────────

interface RequestWithUser {
  user?: {
    user_session?: Partial<IUserSession>;
  };
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  method?: string;
  url?: string;
  socket?: { remoteAddress?: string };
}

type PatchedServerResponse = import('http').ServerResponse & {
  locals?: Record<string, unknown>;
};

// ──────────────────────────────────────────────────────────────
//  Log level resolution
//  Priority: explicit opts.level → LOG_LEVEL env → 'info'.
//  Falls back to 'info' on an unknown value so a typo'd env var never
//  crashes logger setup at boot (pino throws on an invalid level string).
// ──────────────────────────────────────────────────────────────

const PINO_LEVELS = new Set([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
]);

function resolveLogLevel(explicit?: string): string {
  const candidate = (explicit ?? process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return PINO_LEVELS.has(candidate) ? candidate : 'info';
}

// ──────────────────────────────────────────────────────────────
//  Sensitive key redaction (recursive — pino path-string is not deep)
// ──────────────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'authorization',
  'cookie',
  'x-csrf-token',
  'x-access-token',
]);

function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 10 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    result[k] = SENSITIVE_KEYS.has(k.toLowerCase())
      ? '[Redacted]'
      : redactDeep(v, depth + 1);
  }
  return result;
}

// ──────────────────────────────────────────────────────────────
//  Ignore paths
// ──────────────────────────────────────────────────────────────

const IGNORE_SUFFIXES = ['/health', '/api-docs', '/json-docs', '/classic-docs'];
const IGNORE_PATTERN = /\/socket\.io\//;

function shouldIgnore(url: string): boolean {
  if (IGNORE_PATTERN.test(url)) return true;
  const base = url.split('?')[0] ?? '';
  return IGNORE_SUFFIXES.some((suffix) => base.endsWith(suffix));
}

// ──────────────────────────────────────────────────────────────
//  Response body capture middleware
// ──────────────────────────────────────────────────────────────

export function captureResponseBody(
  _req: import('http').IncomingMessage,
  res: PatchedServerResponse,
  next: () => void,
  maxBytes: number,
): void {
  const isAttachment = Boolean(res.getHeader('content-disposition'));
  if (isAttachment) {
    next();
    return;
  }

  const chunks: Buffer<ArrayBufferLike>[] = [];
  let totalBytes = 0;
  let truncated = false;

  const originalWrite = res.write.bind(res) as typeof res.write;
  const originalEnd = res.end.bind(res) as typeof res.end;

  function collectChunk(chunk: unknown): void {
    if (truncated) return;
    const contentType =
      (res.getHeader('content-type') as string | undefined) ?? '';
    if (!contentType.includes('application/json')) return;

    const buf: Buffer<ArrayBufferLike> | null = Buffer.isBuffer(chunk)
      ? chunk
      : typeof chunk === 'string'
        ? Buffer.from(chunk)
        : null;

    if (buf === null) return;
    totalBytes += buf.byteLength;
    if (totalBytes > maxBytes) {
      truncated = true;
      return;
    }
    chunks.push(buf);
  }

  function storeBody(): void {
    res.write = originalWrite;
    res.end = originalEnd;
    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      const parsed: unknown = JSON.parse(raw);
      if (res.locals === undefined) res.locals = {};
      res.locals['responseBody'] = truncated ? { truncated: true } : parsed;
    } catch {
      // non-JSON or empty — ignore silently
    }
  }

  res.write = function patchedWrite(
    chunk: unknown,
    encodingOrCb?: unknown,
    cb?: unknown,
  ): boolean {
    collectChunk(chunk);
    return originalWrite(
      chunk,
      encodingOrCb as BufferEncoding,
      cb as () => void,
    );
  } as typeof res.write;

  res.end = function patchedEnd(
    chunk?: unknown,
    encodingOrCb?: unknown,
    cb?: unknown,
  ): typeof res {
    if (chunk !== null && chunk !== undefined) collectChunk(chunk);
    storeBody();
    return originalEnd(
      chunk as Buffer,
      encodingOrCb as BufferEncoding,
      cb as () => void,
    );
  } as typeof res.end;

  next();
}

// ──────────────────────────────────────────────────────────────
//  Pino logger factory
//  - pino.transport() is fully typed by pino (avoids pino-roll ESM type issues)
//  - pino-roll v4 only date-stamps the file when `dateFormat` (date-fns) is set,
//    producing http.<date>.<count>.log (e.g. http.2026-06-15.1.log).
//    Without it the file is just http.<count>.log. Do NOT put strftime tokens
//    (%Y-%m-%d) in the path — pino-roll treats them as literal characters.
// ──────────────────────────────────────────────────────────────

function buildPinoLogger(
  moduleName: string,
  logDir: string,
  logLevel: string,
  rotateFrequency: string,
  retentionDays: number,
  dateFormat: string,
): PinoLogger {
  const transport = pino.transport({
    targets: [
      {
        target: 'pino-roll',
        level: logLevel,
        options: {
          file: path.join(process.cwd(), logDir, 'http.log'),
          frequency: rotateFrequency,
          dateFormat,
          mkdir: true,
          limit: { count: retentionDays },
        },
      },
      {
        target: 'pino/file',
        level: logLevel,
        options: { destination: 1 },
      },
    ],
  });

  return pino(
    {
      level: logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        // Emit `level` as its string label (info/warn/error) instead of the
        // default numeric value (30/40/50) so it matches the Winston
        // LogsService schema and stays consistent if shipped to Loki later.
        level: (label) => ({ level: label }),
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-csrf-token"]',
          'req.body.password',
        ],
        censor: '[Redacted]',
      },
    },
    transport,
  ).child({ service: moduleName });
}

// ──────────────────────────────────────────────────────────────
//  Public factory
// ──────────────────────────────────────────────────────────────

export function buildPinoHttpMiddleware(
  moduleName: string,
  opts: HttpLoggingOptions,
): (
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  next: () => void,
) => void {
  const enabled = opts.enabled !== false;
  const logLevel = resolveLogLevel(opts.level);
  const includeReqBody = opts.includeReqBody !== false;
  const includeResBody = opts.includeResBody !== false;
  const maxBytes = opts.bodyMaxBytes ?? 32768;
  const logDir = opts.logDir ?? 'logs/http';
  const rotateFrequency = opts.rotateFrequency ?? 'daily';
  const retentionDays = opts.retentionDays ?? 14;
  const dateFormat = opts.dateFormat ?? 'yyyy-MM-dd';

  if (!enabled) {
    return pinoHttp({ autoLogging: false });
  }

  const logger = buildPinoLogger(
    moduleName,
    logDir,
    logLevel,
    rotateFrequency,
    retentionDays,
    dateFormat,
  );

  const pinoHttpOptions: PinoHttpOptions = {
    logger,

    // erp-api has no hand-rolled x-trace-id header (unlike a contextMiddleware
    // setup) — it already runs real OpenTelemetry spans end-to-end (see
    // tracing.ts / OtelRpcContextInterceptor), so reuse that trace ID
    // directly. This ties every HTTP access-log line to the same trace ID
    // shown in Tempo/Grafana. Falls back to a fresh UUID only when tracing is
    // disabled (OTEL_TRACES_ENABLED=false) or no span is active.
    genReqId(req) {
      const traceId = trace.getActiveSpan()?.spanContext().traceId;
      if (traceId !== undefined) return traceId;
      return (
        (req.headers['x-trace-id'] as string | undefined) ?? crypto.randomUUID()
      );
    },

    // customAttributeKeys renames the built-in reqId field to trace_id at the
    // top level — avoids the duplication that customProps causes in pino-http v11
    // (customProps is merged into both the child logger bindings AND the final log call).
    customAttributeKeys: {
      reqId: 'trace_id',
    },

    customLogLevel(_req, res, err) {
      if (err !== undefined && err !== null) return 'error';
      if ((res.statusCode ?? 0) >= 500) return 'error';
      if ((res.statusCode ?? 0) >= 400) return 'warn';
      return 'info';
    },

    autoLogging: {
      ignore(req) {
        return shouldIgnore(req.url ?? '');
      },
    },

    serializers: {
      req(req: RequestWithUser & { raw?: RequestWithUser }) {
        const r = (req as unknown as { raw: RequestWithUser }).raw ?? req;
        const session = r.user?.user_session;
        const forwardedFor = r.headers['x-forwarded-for'];
        const clientIp =
          (Array.isArray(forwardedFor)
            ? forwardedFor[0]
            : forwardedFor?.split(',')[0]?.trim()) ??
          r.socket?.remoteAddress ??
          'N/A';
        const base = {
          method: r.method,
          url: r.url,
          headers: redactDeep(r.headers),
          correlation_id: r.headers['x-correlation-id'] ?? 'N/A',
          client_ip: clientIp,
          user_agent: r.headers['user-agent'] ?? 'N/A',
          ...(session !== undefined
            ? {
                user: {
                  id: session.id,
                  username: session.username,
                  roles: session.roles,
                },
              }
            : {}),
        };
        if (!includeReqBody) return base;
        return { ...base, body: redactDeep(r.body) };
      },

      res(res: PatchedServerResponse & { raw?: PatchedServerResponse }) {
        const raw =
          (res as unknown as { raw: PatchedServerResponse }).raw ?? res;
        const base = { statusCode: raw.statusCode };
        if (!includeResBody) return base;
        return { ...base, body: raw.locals?.['responseBody'] ?? undefined };
      },
    },
  };

  const middleware = pinoHttp(pinoHttpOptions);

  if (!includeResBody) {
    return middleware;
  }

  return (
    req: import('http').IncomingMessage,
    res: PatchedServerResponse,
    next: () => void,
  ) => {
    captureResponseBody(req, res, () => middleware(req, res, next), maxBytes);
  };
}
