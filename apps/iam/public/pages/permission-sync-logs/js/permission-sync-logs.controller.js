import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { handleChangePasswordSubmit } from '../../../js/change-password.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  goToPermissionSyncLogsPage,
  loadPermissionSyncLogs,
  setPermissionSyncLogsPageSize,
  setPermissionSyncLogsSort,
} from '../../user-management/js/permission-sync-logs.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import { createSortableTable } from '../../user-management/js/sortable-table.js';

Object.assign(window, {
  handleAuthLogin,
  handleChangePasswordSubmit,
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

function wireSort() {
  createSortableTable({
    container: document.querySelector('#permissionSyncLogsTable thead'),
    defaultSort: 'created_at:desc',
    onChange: setPermissionSyncLogsSort,
  });
}

wireFilters();
wireSort();
bootAdminPage({
  pagePermission: 'page:view_permission_sync_logs',
  loader: () => loadPermissionSyncLogs(1),
});
