import type { IAuditFields } from './common.contract';

export type UserStatus = 'active' | 'pending' | 'suspended';

/** `users` resource attributes (iam-bc) as returned by the API. */
export interface IUserAttributes extends IAuditFields {
  username: string;
  employee_id: string;
  full_name: string;
  email: string;
  department: string | null;
  status: UserStatus;
}

export interface ICreateUserPayload {
  username: string;
  employee_id: string;
  full_name: string;
  email: string;
  department?: string | null;
}

export interface IAssignRolePayload {
  role_ids: string[];
}
