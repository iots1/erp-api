/**
 * Swagger/Scalar documentation strings for `PermissionSyncsController`.
 */

export const GET_PERMISSION_SYNCS_SUMMARY =
  'List permission_sync_logs history (past permissions:sync runs)';
export const GET_PERMISSION_SYNC_SUMMARY = 'Get a permission sync run by id';
export const CREATE_PERMISSION_SYNC_SUMMARY =
  'Trigger a new permissions:sync run in-process (scan @RequirePermission()/data-permission usage and diff into the catalog) — same effect as the CLI script, creates a new permission_sync_logs row';

export const PERMISSION_SYNC_ID_PARAM_DESCRIPTION = 'Permission sync log id';
