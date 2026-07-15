/**
 * TCP message patterns exposed by the IAM Bounded Context. Other services (e.g. the
 * `auth` service) call these via the `IAM_SERVICE` {@link ClientProxy} instead of
 * touching the IAM database directly.
 */
export const IamMessagePatterns = {
  /** Verify username/email + password; returns the safe user or null. */
  ValidateCredentials: 'iam.users.validate-credentials',
  /** Create a new user (hashes the password inside IAM). */
  Register: 'iam.users.register',
  /** Fetch a safe user by id. */
  FindById: 'iam.users.find-by-id',
} as const;

/** User shape returned by IAM over TCP — never includes the password hash. */
export interface IIamUser {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  roles: string[];
  is_active: boolean;
}

/** Payload for {@link IamMessagePatterns.ValidateCredentials}. */
export interface IValidateCredentialsPayload {
  username: string;
  password: string;
}

/** Payload for {@link IamMessagePatterns.Register}. */
export interface IRegisterUserPayload {
  username: string;
  email: string;
  password: string;
  full_name: string | null;
}
