import { SetMetadata } from '@nestjs/common';

export const SKIP_PERMISSION_CHECK_KEY = 'skip_permission_check';

/**
 * Opts an authenticated (non-`@Public()`) endpoint out of `PermissionGuard`'s
 * default-deny. `AuthGuard` still runs in full — a valid JWT and a live Redis
 * session are required — only the `@RequirePermission()` requirement is
 * skipped. For endpoints where "the caller is authenticated" is the entire
 * authorization rule, e.g. `GET /auth/me` returning the caller's own session:
 * there is no permission string that would make sense to gate a user reading
 * their own identity behind.
 */
export const SkipPermissionCheck = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(SKIP_PERMISSION_CHECK_KEY, true);
