import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { NodeSDK } from '@opentelemetry/sdk-node';

import { config as loadEnvFile } from 'dotenv';

/**
 * OpenTelemetry bootstrap, shared by every BC via `@lib/common`.
 *
 * Imported as the FIRST line of `bootstrap.util.ts` (via a direct path import,
 * not the `@lib/common` barrel — see `main.ts` in each app), which in turn is
 * the first thing every service's `main.ts` imports before its own AppModule.
 * That ordering lets the SDK install its require-hook before http/pg/ioredis/
 * amqplib/nestjs are loaded, so auto-instrumentation can patch them. Loading it
 * via the barrel would evaluate every other `@lib/common` export (decorators,
 * DTOs, guards, ...) first, which transitively `require()`s their node_modules
 * deps before this file ever runs — too late for the hook.
 *
 * webpack keeps node_modules external (webpack-node-externals, allowlist
 * `/^@lib/` — see webpack.config.js), so those stay as real `require()` calls
 * the hook can intercept; instrumentation would NOT work if bundled.
 *
 * Telemetry must never break a service: any failure here is swallowed.
 *
 * Shutdown: this file only starts the SDK and exports `shutdownTracing()`.
 * `GracefulShutdownService.onApplicationShutdown()` calls it as the very last
 * step, after `app.close()` has already drained HTTP/TCP/RMQ/DB — starting it
 * from a process-level signal handler here would race that drain.
 *
 * Env:
 *   OTEL_TRACES_ENABLED          "false" disables tracing (default: enabled)
 *   OTEL_SERVICE_NAME            service.name (defaults to the app name parsed
 *                                 from the entry path, e.g. "iam" from
 *                                 dist/apps/iam/main.js)
 *   OTEL_EXPORTER_OTLP_ENDPOINT  collector gRPC endpoint
 *                                 (default http://127.0.0.1:4317 → local Alloy/Collector)
 *   OTEL_NODE_DISABLED_INSTRUMENTATIONS  comma list (default: "fs")
 */

/**
 * service.name resolution — no per-app config needed:
 *   1. OTEL_SERVICE_NAME if set
 *   2. the `dist/apps/<name>/main.js` segment of the entry path (always
 *      present for this monorepo's build output, and for `nest start` dev mode
 *      via `apps/<name>/src/main.ts`)
 *   3. 'erp-service' fallback
 */
function resolveServiceName(): string {
  const explicit = process.env.OTEL_SERVICE_NAME;
  if (explicit !== undefined && explicit.length > 0) return explicit;

  const entry = process.argv[1] ?? '';
  const match = /apps\/([^/]+)\/(?:src\/)?main\.[cm]?[jt]s$/.exec(entry);
  return match?.[1] ?? 'erp-service';
}

// This file runs before `ConfigModule.forRoot({ envFilePath: ['.env'] })`
// (libs/config/src/config.module.ts) ever gets a chance to parse `.env` into
// process.env — that only happens once NestFactory.create() builds the module
// tree, well after the OTel SDK below needs to already be configured. Load it
// here too so OTEL_* keys set only in `.env` (not the real shell/container
// env) are still picked up. No-ops quietly if `.env` is absent — production
// injects real env vars directly, it doesn't ship the file.
loadEnvFile();

// Module-scoped so `shutdownTracing()` (called from GracefulShutdownService's
// onApplicationShutdown) can reach the same instance `sdk.start()` used.
let otelSdk: NodeSDK | undefined;

if (process.env.OTEL_TRACES_ENABLED !== 'false') {
  try {
    // The SDK reads service.name from OTEL_SERVICE_NAME — set it once here.
    process.env.OTEL_SERVICE_NAME = resolveServiceName();

    // Disable the noisy fs instrumentation via env (avoids a config object
    // keyed by a non-identifier package name).
    process.env.OTEL_NODE_DISABLED_INSTRUMENTATIONS ??= 'fs';

    const endpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://127.0.0.1:4317';

    otelSdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({ url: endpoint }),
      instrumentations: [getNodeAutoInstrumentations()],
    });

    otelSdk.start();

    console.log(
      `[otel] tracing started for "${process.env.OTEL_SERVICE_NAME ?? 'unknown-service'}" → ${endpoint}`,
    );
  } catch (err) {
    console.warn(
      '[otel] tracing disabled:',
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Flush + stop the OTel SDK. Call this as the LAST step of shutdown, after
 * `app.close()` has already drained HTTP/TCP/RMQ/DB — never from a
 * process-level signal handler racing against that drain. No-op (and never
 * throws) when tracing was disabled or failed to start.
 */
export async function shutdownTracing(): Promise<void> {
  if (otelSdk === undefined) return;
  try {
    await otelSdk.shutdown();
  } catch (err) {
    console.warn(
      '[otel] error during shutdown:',
      err instanceof Error ? err.message : err,
    );
  }
}
