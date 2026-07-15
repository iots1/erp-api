import { ITimestamp } from '@lib/common/interfaces/timestamp.interface';

/**
 * Minimal user shape referenced by audit fields. ERP keeps this lightweight;
 * the authoritative user record lives in the auth service.
 */
export interface IUser extends ITimestamp {
  id: string;
  username: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}
