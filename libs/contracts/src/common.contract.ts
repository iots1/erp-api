/** Shared enums/value types used across BCs and the web client. */

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

/** Audit fields present on every persisted resource. */
export interface IAuditFields {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
}
