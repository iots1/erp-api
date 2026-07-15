/**
 * TCP message patterns exposed by the IAM Bounded Context. Other services (e.g. the
 * `auth` service) call these via the `IAM_SERVICE` {@link ClientProxy} instead of
 * touching the IAM database directly. Credentials live in auth-bc's own DB — iam-bc
 * only ever answers "who is this user" and "what can they do" questions.
 */
export const IamMessagePatterns = {
  /** Fetch a user's basic profile + status by id. */
  FindById: 'iam.users.find-by-id',
  /** Resolve a user's net (deny-override applied) permission set for the JWT. */
  ResolvePermissions: 'iam.access.resolve-permissions',
  /** Evaluate ABAC conditions for a single resource:action at request time. */
  EvaluateConditions: 'iam.access.evaluate-conditions',
} as const;

/** User shape returned by IAM over TCP — never includes any credential data. */
export interface IIamUser {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  department: string | null;
  status: 'active' | 'pending' | 'suspended';
}

/** Payload for {@link IamMessagePatterns.FindById}. */
export interface IFindByIdPayload {
  user_id: string;
}

/** Payload for {@link IamMessagePatterns.ResolvePermissions}. */
export interface IResolvePermissionsPayload {
  user_id: string;
}

/** Result of {@link IamMessagePatterns.ResolvePermissions}. */
export interface IResolvedPermissions {
  roles: string[];
  /** Net unconditional resource:action strings (deny-override already applied) — go straight into the JWT. */
  permissions: string[];
  /** resource:action strings that are conditionally granted — the guard must call EvaluateConditions before allowing these. */
  conditional_permissions: string[];
}

/** Payload for {@link IamMessagePatterns.EvaluateConditions}. */
export interface IEvaluateConditionsPayload {
  user_id: string;
  service: string;
  resource: string;
  action: string;
  /** Request-time context values referenced by condition keys, e.g. `{ 'context.current_time': '18:30', 'customer.owner_id': '...' }`. */
  context: Record<string, string>;
}
