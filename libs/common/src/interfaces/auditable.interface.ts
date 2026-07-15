import { IUser } from '@lib/common/interfaces/user.interface';

export interface IAuditable {
  created_by: string | Partial<IUser> | null;
  updated_by: string | Partial<IUser> | null;
  deleted_by: string | Partial<IUser> | null;
}
