import { createAdminPage } from '../../user-management/js/admin-page.js';
import {
  goToPermissionSyncLogsPage,
  loadPermissionSyncLogs,
  setPermissionSyncLogsPageSize,
  setPermissionSyncLogsSort,
} from '../../user-management/js/permission-sync-logs.service.js';

createAdminPage({
  pagePermission: 'page:view_permission_sync_logs',
  globals: { goToPermissionSyncLogsPage },
  load: () => loadPermissionSyncLogs(1),
  // No `filters` — a sync-run log has no free-text or categorical field worth
  // filtering on; it's a chronological audit trail.
  pageSize: { id: 'permissionSyncLogPageSize', set: setPermissionSyncLogsPageSize },
  sort: {
    tableId: 'permissionSyncLogsTable',
    defaultSort: 'created_at:desc',
    set: setPermissionSyncLogsSort,
  },
});
