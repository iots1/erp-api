import { SetMetadata } from '@nestjs/common';

export const IS_ACCESS_KEY_ROUTE_KEY = 'isAccessKeyRoute';

/**
 * Marks a route (or controller) as Access Key/Secret Key-authenticated
 * (system-to-system) instead of JWT-authenticated. `AuthGuard` skips its JWT
 * check for these routes and defers to `AccessKeyGuard`, which verifies the
 * HMAC signature and populates `request.user` in the same shape `AuthGuard`
 * would, so `PermissionGuard` runs unchanged afterwards.
 */
export const UseAccessKey = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(IS_ACCESS_KEY_ROUTE_KEY, true);
