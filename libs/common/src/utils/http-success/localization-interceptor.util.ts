import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const TH_SUFFIX = '_th';
const EN_SUFFIX = '_en';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !(value instanceof Date)
  );
}

/**
 * Collapses every `<field>_th` / `<field>_en` flat column pair into a nested
 * `<field>: { th, en }` object, recursively over objects and arrays. Always
 * emits both keys (even when one side is null) so the response contract is stable.
 */
function collapseLocalizedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    const items = value as unknown[];
    return items.map((item) => collapseLocalizedFields(item)) as unknown as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const source = value;
  const result: Record<string, unknown> = {};
  const handled = new Set<string>();

  for (const key of Object.keys(source)) {
    if (handled.has(key)) continue;

    if (key.endsWith(TH_SUFFIX)) {
      const base = key.slice(0, -TH_SUFFIX.length);
      const enKey = `${base}${EN_SUFFIX}`;
      if (enKey in source) {
        result[base] = {
          th: (source[key] as string | null) ?? null,
          en: (source[enKey] as string | null) ?? null,
        };
        handled.add(key);
        handled.add(enKey);
        continue;
      }
    }

    if (key.endsWith(EN_SUFFIX)) {
      const base = key.slice(0, -EN_SUFFIX.length);
      const thKey = `${base}${TH_SUFFIX}`;
      if (thKey in source) {
        result[base] = {
          th: (source[thKey] as string | null) ?? null,
          en: (source[key] as string | null) ?? null,
        };
        handled.add(key);
        handled.add(thKey);
        continue;
      }
    }

    result[key] = collapseLocalizedFields(source[key]);
    handled.add(key);
  }

  return result as unknown as T;
}

/**
 * Collapses bilingual (TH/EN) flat column pairs on response payloads before the
 * JSON:API envelope is built. See `docs/plan-erp/i18n-guide.html` — input/DTOs
 * stay flat (`name_th`, `name_en`); only responses get the nested `{ th, en }` shape.
 */
@Injectable()
export class LocalizationInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(map((data: unknown) => collapseLocalizedFields(data)));
  }
}
