import { types as pgTypes } from 'pg';

import { toDateOnly, todayDateOnly } from './date-only.util';

describe('date-only.util', () => {
  describe('toDateOnly', () => {
    it('formats a UTC-midnight Date as YYYY-MM-DD', () => {
      expect(toDateOnly(new Date('2026-07-29T00:00:00.000Z'))).toBe(
        '2026-07-29',
      );
    });

    it('formats a Date carrying a time-of-day component using its calendar date', () => {
      expect(toDateOnly(new Date('2026-01-05T23:59:59.000Z'))).toBe(
        '2026-01-06',
      );
    });

    it('pads single-digit month and day', () => {
      expect(toDateOnly(new Date('2026-03-04T12:00:00.000Z'))).toBe(
        '2026-03-04',
      );
    });

    it('round-trips a real pg `date`-column value correctly (the bug this util fixes)', () => {
      // node-postgres's own DATE (oid 1082) type parser builds the returned
      // `Date` from the raw y/m/d in the *process's local* timezone — see the
      // module docblock. bootstrap.util.ts pins `process.env.TZ` to
      // 'Asia/Bangkok' for every real app process, so that's what's
      // reproduced here. `.toISOString().slice(0, 10)` (the bug this util
      // replaces) would read back '2026-07-28' for this same value.
      const originalTz = process.env.TZ;
      process.env.TZ = 'Asia/Bangkok';
      try {
        const parseDate = pgTypes.getTypeParser(1082) as (raw: string) => Date;
        expect(toDateOnly(parseDate('2026-07-29'))).toBe('2026-07-29');
      } finally {
        process.env.TZ = originalTz;
      }
    });
  });

  describe('todayDateOnly', () => {
    it('returns a YYYY-MM-DD string', () => {
      expect(todayDateOnly()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('matches toDateOnly(new Date()) at the moment it is called', () => {
      const now = new Date();
      expect(todayDateOnly()).toBe(toDateOnly(now));
    });
  });
});
