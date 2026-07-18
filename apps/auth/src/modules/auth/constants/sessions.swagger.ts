/**
 * Swagger/Scalar documentation strings for `SessionsController`.
 */

export const GET_SESSIONS_SUMMARY =
  'List currently active sessions (live Redis `session:<jti>` keys) — who is logged in right now';
export const REVOKE_SESSION_SUMMARY =
  "Force-logout a session: deletes its Redis key and revokes the owning user's refresh tokens";
export const SESSION_JTI_PARAM_DESCRIPTION = 'Session id (JWT `jti`)';
