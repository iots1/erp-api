const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
};

/** Parses durations like '15m', '7d', '30s' (as used by JWT_*_EXPIRES_IN) into seconds. */
export function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(
      `Invalid duration format: '${duration}' (expected e.g. '15m', '7d')`,
    );
  }
  const [, value, unit] = match;
  return Number(value) * UNIT_SECONDS[unit];
}
