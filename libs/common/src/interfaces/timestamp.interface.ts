export interface ITimestamp {
  created_at: Date;
  created_by: string | null;
  updated_at: Date;
  updated_by: string | null;
  is_deleted: boolean;
  deleted_reason: string | null;
  deleted_at: Date | null;
  deleted_by: string | null;
}
