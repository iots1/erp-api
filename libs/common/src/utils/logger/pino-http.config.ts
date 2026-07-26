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
  'csrf_token',
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
//  Per-service log dir
//  Converts the root module class name (IamModule, FinanceBcModule, ...) to
//  the same kebab-case slug as its apps/<slug> folder (iam, finance-bc, ...)
//  so every BC gets its own log file by default instead of colliding on a
//  shared 'logs/http/http.log' when multiple services share a cwd.
// ──────────────────────────────────────────────────────────────

function serviceSlug(moduleName: string): string {
  return moduleName
    .replace(/Module$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
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
        // `level` MUST stay the numeric pino value (30/40/50) — do NOT change
        // this to emit the string label alone.
        //
        // With a multi-target transport, pino's worker (pino/lib/worker.js)
        // feeds every line through `pino.multistream`, which routes it by
        // comparing the level parsed off the JSON line against each target's
        // own `level` (`level >= dest.level`). A string label makes that
        // `"info" >= 20` → false, so EVERY line is silently dropped for ALL
        // targets: the log file is still created (sonic-boom opens it) but
        // stays 0 bytes, and no error is emitted anywhere.
        //
        // The human-readable label is emitted alongside as `level_label` for
        // Loki/Grafana, which keeps the numeric routing intact.
        level: (label, number) => ({ level: number, level_label: label }),
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
  const logDir =
    opts.logDir ?? path.join('logs', serviceSlug(moduleName), 'http');
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
        const forwardedFor = r.headers['x-forwarded-for'];
        const clientIp =
          (Array.isArray(forwardedFor)
            ? forwardedFor[0]
            : forwardedFor?.split(',')[0]?.trim()) ??
          r.socket?.remoteAddress ??
          'N/A';
        // Neither the request body nor the authenticated user are included
        // here — see the res() serializer below for why (pino freezes req's
        // chindings at Fastify's 'onRequest', before body parsing AND before
        // AuthGuard runs) and where they actually get attached (as
        // `res.req_body` / `res.user`).
        return {
          method: r.method,
          url: r.url,
          headers: redactDeep(r.headers),
          correlation_id: r.headers['x-correlation-id'] ?? 'N/A',
          client_ip: clientIp,
          user_agent: r.headers['user-agent'] ?? 'N/A',
        };
      },

      res(
        res: PatchedServerResponse & {
          raw?: PatchedServerResponse;
          req?: RequestWithUser;
        },
      ) {
        const raw =
          (res as unknown as { raw: PatchedServerResponse }).raw ?? res;
        const base: Record<string, unknown> = { statusCode: raw.statusCode };

        // pino-http binds `req` into the log line via `logger.child({ req })`
        // at Fastify's 'onRequest' hook — before the body is parsed and
        // before AuthGuard runs — and pino serializes child bindings once,
        // immediately, at that call. So neither the body nor the
        // authenticated user can ever be populated through the req
        // serializer above; both are permanently frozen at their pre-parse /
        // pre-auth (undefined) state there. The res serializer, by contrast,
        // runs fresh at response-finish (see pino-http/logger.js
        // onResFinished), by which point bootstrap.util.ts's `preValidation`
        // hook has copied the parsed body onto `request.raw.body` and its
        // `onSend` hook has copied `request.user` onto `request.raw.user` —
        // and Node's ServerResponse always carries `.req` back to its
        // IncomingMessage, so both are still reachable from here.
        const rawReq = (raw as unknown as { req?: RequestWithUser }).req;

        if (includeReqBody && rawReq?.body !== undefined) {
          base['req_body'] = redactDeep(rawReq.body);
        }

        const session = rawReq?.user?.user_session;
        if (session !== undefined) {
          base['user'] = {
            id: session.id,
            username: session.username,
            roles: session.roles,
          };
        }

        if (!includeResBody) return base;
        // Redact the response body too — an auth response carries
        // access_token/refresh_token/csrf_token, which would otherwise be
        // written to disk (and shipped to Loki) in plaintext.
        const body = raw.locals?.['responseBody'];
        return {
          ...base,
          body: body === undefined ? undefined : redactDeep(body),
        };
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
