/**
 * Authenticated user session attached to the request by the AuthGuard.
 * Kept intentionally lightweight for ERP (no domain-specific profile fields).
 */
export interface IUserSession {
  id: string | null;
  username: string | null;
  fullname: string | null;
  email: string | null;
  roles: string[];
  permissions: string[];
  /** JWT id (token identifier) */
  jti: string | null;
}
