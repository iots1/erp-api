import { randomInt } from 'crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

/** Cryptographically random temp password for a newly-created user — one of each
 * character class guaranteed, then padded to `length` and shuffled. Ambiguous
 * characters (0/O, 1/l/I) are excluded so it's easy to read off a screen and
 * retype. Only ever shown once, in the create-user response. */
export function generateTempPassword(length = 12): string {
  const pick = (charset: string): string =>
    charset[randomInt(charset.length)];

  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const rest = Array.from({ length: length - required.length }, () =>
    pick(ALL),
  );

  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
