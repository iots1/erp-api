import {
  ICallContext,
  ILogData,
} from '@lib/common/modules/log/interfaces/log-context.interface';

export interface ILogger {
  info(logData: ILogData): void;
  warn(logData: ILogData): void;
  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void;
  debug(logData: ILogData): void;
  setContext(serviceName: string, serviceVersion: string): void;
  setContextFromPayload(context: ICallContext): void;
}
