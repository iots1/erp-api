import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_CHECK_KEY = 'skip_csrf_check';

/**
 * Opts a mutating endpoint out of `CsrfGuard`. Only `POST /auth/login` should
 * ever need this — it runs before any `csrf_token` cookie exists, and is
 * protected by the credential body instead (see auth-cookie.util.ts /
 * csrf.guard.ts for the double-submit design this decorator is exempting).
 */
export const SkipCsrfCheck = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(SKIP_CSRF_CHECK_KEY, true);
