import { BadRequestException } from '@nestjs/common';

/**
 * Parses/formats a running-number pattern like `INV-{YYYY}{MM}-{SEQ:5}`.
 * Supported tokens: `{YYYY}` (4-digit year), `{YY}` (2-digit year), `{MM}`
 * (2-digit month), `{DD}` (2-digit day), `{SEQ:n}` (n-digit zero-padded
 * sequence — required, exactly one occurrence). Everything else is literal.
 *
 * The date tokens are resolved to *literal* values (not `\d{4}` wildcards)
 * when building the match regex — this is deliberate: it makes a period
 * rollover (e.g. the month changing) behave exactly like an admin editing
 * the format, since last month's issued value naturally stops matching this
 * month's regex. One mechanism covers both "format changed" and "period
 * rolled over" resets, matching how this codebase's document numbering is
 * meant to work.
 */

const TOKEN_RE = /\{YYYY\}|\{YY\}|\{MM\}|\{DD\}|\{SEQ:(\d+)\}/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface DateParts {
  yyyy: string;
  yy: string;
  mm: string;
  dd: string;
}

function resolveDateParts(now: Date): DateParts {
  const yyyy = String(now.getFullYear());
  return {
    yyyy,
    yy: yyyy.slice(-2),
    mm: String(now.getMonth() + 1).padStart(2, '0'),
    dd: String(now.getDate()).padStart(2, '0'),
  };
}

export interface ParsedRunningNumberFormat {
  /** Matches a previously-issued value for the *current* period; capture group 1 = the sequence digits. */
  regex: RegExp;
  seqDigits: number;
}

/**
 * Builds the current-period match regex for `format`. Throws
 * `BadRequestException` if `format` doesn't contain exactly one `{SEQ:n}`
 * token (every running-number format must have one — the running-number
 * config form validates this same way before save).
 */
export function parseRunningNumberFormat(
  format: string,
  now: Date,
): ParsedRunningNumberFormat {
  const { yyyy, yy, mm, dd } = resolveDateParts(now);

  let regexStr = '^';
  let seqDigits: number | null = null;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(format)) !== null) {
    regexStr += escapeRegExp(format.slice(lastIndex, match.index));
    const token = match[0];

    if (token === '{YYYY}') regexStr += escapeRegExp(yyyy);
    else if (token === '{YY}') regexStr += escapeRegExp(yy);
    else if (token === '{MM}') regexStr += escapeRegExp(mm);
    else if (token === '{DD}') regexStr += escapeRegExp(dd);
    else {
      if (seqDigits !== null) {
        throw new BadRequestException(
          'running_number_format must contain exactly one {SEQ:n} placeholder.',
        );
      }
      seqDigits = Number(match[1]);
      regexStr += `(\\d{${seqDigits}})`;
    }

    lastIndex = TOKEN_RE.lastIndex;
  }
  regexStr += escapeRegExp(format.slice(lastIndex)) + '$';

  if (seqDigits === null) {
    throw new BadRequestException(
      'running_number_format must contain exactly one {SEQ:n} placeholder.',
    );
  }

  return { regex: new RegExp(regexStr), seqDigits };
}

/** Formats `seq` into the full document number string for `format` at `now`. */
export function formatRunningNumber(
  format: string,
  now: Date,
  seq: number,
  seqDigits: number,
): string {
  const { yyyy, yy, mm, dd } = resolveDateParts(now);
  return format
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{YY\}/g, yy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
    .replace(/\{SEQ:\d+\}/g, String(seq).padStart(seqDigits, '0'));
}
