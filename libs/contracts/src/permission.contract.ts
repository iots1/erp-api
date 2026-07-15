import type { IAuditFields } from './common.contract';
import type { ILocalizedText } from './role.contract';

export type PermissionPlane = 'ui' | 'api';

/** `permissions` resource attributes (iam-bc) — read-only catalog. */
export interface IPermissionAttributes extends IAuditFields {
  permission: string;
  resource: string;
  action: string;
  plane: PermissionPlane;
  permission_name: ILocalizedText;
}
