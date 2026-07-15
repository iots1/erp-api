export interface ISoftDeletable {
  is_deleted: boolean;
  deleted_at: Date | null;
}
