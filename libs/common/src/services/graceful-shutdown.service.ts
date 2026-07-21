import type { IncomingMessage, ServerResponse } from 'http';

import {
  INestApplication,
  Injectable,
  OnApplicationShutdown,
} from '@nestjs/common';

import { shutdownTracing } from '@lib/common/tracing';

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 30_000;

/** Minimal shape of what we need from `app.getHttpServer()` (typed `any` by NestJS). Fastify exposes the same raw Node `http.Server` here as Express does. */
interface ShutdownAwareHttpServer {
  on?: (
    event: 'request',
    listener: (req: IncomingMessage, res: ServerResponse) => void,
  ) => void;
}

/**
 * Wires SIGTERM/SIGINT to NestJS's official `app.enableShutdownHooks()` and
 * implements `OnApplicationShutdown` to flush OpenTelemetry as the LAST step
 * of the shutdown sequence.
 *
 * Registered as a provider in `CommonModule` (which is `@Global()` and
 * imported by every microservice's root module), so this single instance's
 * `onApplicationShutdown` hook is picked up automatically app-wide with no
 * per-service wiring.
 *
 * Sequence on SIGTERM/SIGINT:
 *   1. `beginShutdown()` (via `process.once`, registered BEFORE
 *      `enableShutdownHooks()` so it observes the signal first) flips
 *      `isShuttingDown()` to true immediately, arms the idle-socket eviction
 *      hook (see below), and arms a force-exit safety timer — this must
 *      happen before `app.close()` even starts, so the readiness route can
 *      fail fast for a load balancer while in-flight work still drains.
 *   2. Nest's own listener (from `enableShutdownHooks()`) calls `app.close()`,
 *      which triggers onModuleDestroy / beforeApplicationShutdown across every
 *      provider: HTTP stops accepting new connections but drains in-flight
 *      requests, the TCP/RMQ microservice listener closes, TypeORM/Redis
 *      connections disconnect.
 *   3. `onApplicationShutdown()` below runs near the very end of that
 *      sequence — after everything above already tore down — so it's the
 *      correct place to flush OTel. It also clears the force-exit timer.
 *   4. Nest re-emits the original signal with no listeners left on it, so
 *      Node's default disposition (terminate) finishes the process — no
 *      manual `process.exit()` needed on the happy path.
 *
 * Why the `'request'` listener below is required (mirrors the measurement
 * behind the same fix in the reference platform, on Node 24):
 *   - Node's `http.Server.close()` already closes sockets that are idle at
 *     the moment it is called (e.g. a gateway's warm keep-alive pool). No
 *     help needed there.
 *   - What it does NOT handle: a request that is still IN FLIGHT when
 *     `close()` is called. That request completes normally (the client gets
 *     its full response), but its socket then returns to the keep-alive pool
 *     as newly-idle — after `close()` already did its idle sweep. Node never
 *     closes that socket on its own, so `server.close()` never resolves.
 *
 * That hang is what makes this a correctness bug rather than a tidiness one:
 * `app.close()` never resolving means `onApplicationShutdown` never runs, the
 * force-exit timer is never cleared, and at `shutdownTimeoutMs` the process is
 * killed with `process.exit(1)` — terminating whatever requests happened to be
 * in flight at that moment. Destroying the socket right after `'finish'` is
 * safe: `'finish'` only fires once the entire response has been flushed.
 */
@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private shuttingDown = false;
  private forceExitTimer: NodeJS.Timeout | undefined;

  /** Bound as a class property so it can be passed as a bare callback (e.g. to the readiness route) without `.bind()`. */
  isShuttingDown = (): boolean => this.shuttingDown;

  registerSignalHandlers(
    app: INestApplication,
    moduleName: string,
    shutdownTimeoutMs: number = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  ): void {
    const httpServer = app.getHttpServer() as ShutdownAwareHttpServer;

    // Attached once, up front (not inside beginShutdown) so it's already in
    // place for every request regardless of when it arrives. The check is
    // deliberately at response-FINISH time rather than request-start time:
    // the socket that strands app.close() belongs to a request that STARTED
    // before the signal and finished after it, so a start-time check would
    // miss exactly the case this exists to handle.
    httpServer.on?.('request', (req: IncomingMessage, res: ServerResponse) => {
      res.on('finish', () => {
        if (this.shuttingDown) {
          req.socket?.destroy();
        }
      });
    });

    const beginShutdown = (signal: NodeJS.Signals): void => {
      if (this.shuttingDown) return;
      this.shuttingDown = true;

      console.log(
        `🛑 [${moduleName}] Received ${signal}, draining before shutdown...`,
      );

      // Safety net: if app.close() hangs (a stuck DB/Redis connection, a
      // never-resolving RPC handler), force-exit rather than leave a zombie
      // process. `.unref()` so this timer itself can't keep the process
      // alive once real work is done. Cleared in onApplicationShutdown() on
      // the happy path.
      this.forceExitTimer = setTimeout(() => {
        console.error(
          `❌ [${moduleName}] Shutdown exceeded ${shutdownTimeoutMs}ms — forcing exit`,
        );
        process.exit(1);
      }, shutdownTimeoutMs);
      this.forceExitTimer.unref();
    };

    // Registered BEFORE enableShutdownHooks() so this fires first when the
    // signal arrives. `.once()` so it self-removes — it must NOT still be
    // attached when Nest re-emits the signal after a successful close(), or
    // Node would invoke it again instead of falling through to the default
    // (terminate) disposition.
    process.once('SIGTERM', () => beginShutdown('SIGTERM'));
    process.once('SIGINT', () => beginShutdown('SIGINT'));

    app.enableShutdownHooks();
  }

  async onApplicationShutdown(): Promise<void> {
    await shutdownTracing();
    if (this.forceExitTimer !== undefined) {
      clearTimeout(this.forceExitTimer);
    }
  }
}
