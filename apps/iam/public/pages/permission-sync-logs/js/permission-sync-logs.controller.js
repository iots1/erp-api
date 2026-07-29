import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  goToPermissionSyncLogsPage,
  loadPermissionSyncLogs,
  setPermissionSyncLogsPageSize,
} from '../../user-management/js/permission-sync-logs.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
  goToPermissionSyncLogsPage,
});

function wireFilters() {
  const pageSizeSelect = document.getElementById('permissionSyncLogPageSize');
  pageSizeSelect?.addEventListener('change', (e) =>
    setPermissionSyncLogsPageSize(e.target.value),
  );
}

wireFilters();
bootAdminPage({
  pagePermission: 'page:view_permission_sync_logs',
  loader: () => loadPermissionSyncLogs(1),
});
