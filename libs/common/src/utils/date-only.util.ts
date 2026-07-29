import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

/** Mirrors `bootstrap.util.ts`'s `initializeTimezone()` and
 * `TypeOrmQueryBuilder.DEFAULT_TIMEZONE` — the project's one default
 * timezone, kept explicit here instead of relying on `process.env.TZ`
 * (already set at bootstrap, but this file must also behave correctly in
 * contexts that never call bootstrapApplication, e.g. migrations, scripts,
 * unit tests). */
const DEFAULT_TIMEZONE = 'Asia/Bangkok';

/**
 * Formats a `Date` as a `YYYY-MM-DD` string in the project's default
 * timezone (Asia/Bangkok). Postgres `date` columns round-trip through the
 * `pg` driver's default type parser as a `Date` built from the raw value's
 * y/m/d in the *server's local* timezone — so reading it back with
 * `.toISOString()` (UTC) silently shifts the day whenever the server isn't
 * UTC+0. Use this instead everywhere a `date`-typed column value needs to
 * become a plain string.
 */
export function toDateOnly(value: Date): string {
  return dayjs(value).tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD');
}

/** Today as a `YYYY-MM-DD` string in the project's default timezone —
 * comparable against any value produced by {@link toDateOnly}. */
export function todayDateOnly(): string {
  return dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD');
}
