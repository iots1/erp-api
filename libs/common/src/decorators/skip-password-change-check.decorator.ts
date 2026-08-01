import { SetMetadata } from '@nestjs/common';

export const SKIP_PASSWORD_CHANGE_CHECK_KEY = 'skip_password_change_check';

/**
 * Opts an authenticated endpoint out of `AuthGuard`'s forced-password-change
 * block. When a session's `must_change_password` is true, every other
 * endpoint is rejected with 403 until the credential is changed — this
 * decorator marks the few routes that must stay reachable in that state:
 * `POST /auth/change-password` (the way out), `POST /auth/logout`, and
 * `GET /auth/me` (so the frontend can read the flag and know to redirect).
 */
export const SkipPasswordChangeCheck = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(SKIP_PASSWORD_CHANGE_CHECK_KEY, true);
