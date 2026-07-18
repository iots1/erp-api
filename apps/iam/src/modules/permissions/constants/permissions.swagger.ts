/**
 * Swagger/Scalar documentation strings for `PermissionsController`.
 */

export const GET_PERMISSIONS_SUMMARY =
  'List permission catalog (for Policy Generator)';
export const GET_PERMISSION_SUMMARY = 'Get permission by id';
export const CREATE_PERMISSION_SUMMARY =
  'Manually add a ui-plane permission (page:*/component:*) — api-plane permissions can only come from permissions:sync';
export const UPDATE_PERMISSION_SUMMARY =
  'Update a permission — display name is always editable, service/permission only if the row was added manually';
export const DELETE_PERMISSION_SUMMARY =
  'Delete a permission — only allowed for manually-added rows, never for rows synced from code';

export const PERMISSION_ID_PARAM_DESCRIPTION = 'Permission id';
