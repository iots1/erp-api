export interface HttpLoggingOptions {
  /** Enable/disable HTTP access logging entirely. @default true */
  enabled?: boolean;
  /** Pino log level. @default 'info' */
  level?: string;
  /** Include request body in logs. @default true */
  includeReqBody?: boolean;
  /** Include response body in logs. @default true */
  includeResBody?: boolean;
  /** Max body size in bytes before truncation. @default 32768 */
  bodyMaxBytes?: number;
  /** Log file directory. @default 'logs/http' */
  logDir?: string;
  /** pino-roll rotation frequency. @default 'daily' */
  rotateFrequency?: string;
  /** Number of log files to retain. @default 14 */
  retentionDays?: number;
  /**
   * date-fns format appended to the rotated file name → `http.<date>.<count>.log`.
   * e.g. 'yyyy-MM-dd' → http.2026-06-15.1.log ; 'yyyy-MM-dd-HH' for hourly.
   * @default 'yyyy-MM-dd'
   */
  dateFormat?: string;
}
