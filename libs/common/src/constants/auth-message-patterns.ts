/**
 * TCP message patterns exposed by the Auth Bounded Context. Other services (e.g. the
 * `iam` service, which owns user profiles but never touches the `credentials` table
 * directly) call these via the `AUTH_SERVICE` {@link ClientProxy} instead of reaching
 * into auth-bc's database. Mirrors {@link IamMessagePatterns}.
 */
export const AuthMessagePatterns = {
  /** Creates the first credential for a newly-created iam-bc user with an
   * admin-generated password, flagged so the user must change it on next login. */
  CreateInitialCredential: 'auth.credentials.create-initial',
  /** Admin flow: overwrites an existing user's credential with a freshly
   * generated password, flagged so the user must change it on next login. */
  ResetPassword: 'auth.credentials.reset-password',
} as const;

/** Payload for {@link AuthMessagePatterns.CreateInitialCredential}. */
export interface ICreateInitialCredentialPayload {
  user_id: string;
  username: string;
  password: string;
  created_by?: string;
}

/** Result of {@link AuthMessagePatterns.CreateInitialCredential}. */
export interface ICreateInitialCredentialResponse {
  success: boolean;
}

/** Payload for {@link AuthMessagePatterns.ResetPassword}. */
export interface IResetPasswordPayload {
  user_id: string;
  username: string;
  password: string;
  reset_by?: string;
}

/** Result of {@link AuthMessagePatterns.ResetPassword}. */
export interface IResetPasswordResponse {
  success: boolean;
}
