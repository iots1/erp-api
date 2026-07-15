import { Injectable, Logger as NestLogger, Scope } from '@nestjs/common';

import { ILogger } from '@lib/common/modules/log/abstracts/logger.abstract';
import type {
  ICallContext,
  ILogData,
} from '@lib/common/modules/log/interfaces/log-context.interface';

/**
 * Lightweight structured logger built on the NestJS Logger.
 *
 * ERP intentionally avoids the heavier winston/file-rotation stack from the
 * reference platform — the same {@link Logger} contract is honored so services
 * (and {@link BaseServiceOperations}) depend only on the abstraction.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LogsService implements ILogger {
  private readonly logger = new NestLogger('app');
  private context = 'app';
  private callContext: Partial<ICallContext> = {};

  setContext(serviceName = 'app', serviceVersion = '0.0.0'): void {
    this.context = `${serviceName}@${serviceVersion}`;
  }

  setContextFromPayload(context: ICallContext): void {
    this.callContext = context;
  }

  info(logData: ILogData): void {
    this.logger.log(this.format(logData), this.context);
  }

  warn(logData: ILogData): void {
    this.logger.warn(this.format(logData), this.context);
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    this.logger.error(
      JSON.stringify({ message, context, details: error?.message }),
      error?.stack,
      this.context,
    );
  }

  debug(logData: ILogData): void {
    this.logger.debug(this.format(logData), this.context);
  }

  private format(logData: ILogData): string {
    const trace = this.callContext.trace?.trace_id;
    return trace != null ? `[${trace}] ${logData.message}` : logData.message;
  }
}

/**
 * No-op logger (Null Object pattern). Used as the default in
 * {@link BaseServiceOperations} when a service is constructed without logging.
 */
export class NoOpLogsService implements ILogger {
  setContext(): void {
    /* no-op */
  }
  setContextFromPayload(): void {
    /* no-op */
  }
  info(): void {
    /* no-op */
  }
  warn(): void {
    /* no-op */
  }
  error(): void {
    /* no-op */
  }
  debug(): void {
    /* no-op */
  }
}
