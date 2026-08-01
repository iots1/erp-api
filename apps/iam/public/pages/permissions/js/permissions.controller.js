import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { handleChangePasswordSubmit } from '../../../js/change-password.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  closePermissionModal,
  confirmDeletePermission,
  ensureServiceFilterOptions,
  goToPermissionsPage,
  handlePermissionFormSubmit,
  handleSyncPermissions,
  loadPermissions,
  openPermissionModal,
  setPermissionsFilter,
  setPermissionsPageSize,
  setPermissionsSort,
} from '../../user-management/js/permissions-admin.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import { createSortableTable } from '../../user-management/js/sortable-table.js';
import { debounce } from '../../user-management/js/utils.js';

Object.assign(window, {
  handleAuthLogin,
  handleChangePasswordSubmit,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
  openPermissionModal,
  closePermissionModal,
  handlePermissionFormSubmit,
  confirmDeletePermission,
  goToPermissionsPage,
  handleSyncPermissions,
});

function wireFilters() {
  const searchInput = document.getElementById('permSearchFilter');
  searchInput?.addEventListener(
    'input',
    debounce((e) => setPermissionsFilter({ search: e.target.value }), 350),
  );

  const serviceSelect = document.getElementById('permServiceFilter');
  serviceSelect?.addEventListener('change', (e) =>
    setPermissionsFilter({ service: e.target.value }),
  );

  const planeSelect = document.getElementById('permPlaneFilter');
  planeSelect?.addEventListener('change', (e) =>
    setPermissionsFilter({ plane: e.target.value }),
  );

  const sourceSelect = document.getElementById('permSourceFilter');
  sourceSelect?.addEventListener('change', (e) =>
    setPermissionsFilter({ source: e.target.value }),
  );

  const pageSizeSelect = document.getElementById('permPageSize');
  pageSizeSelect?.addEventListener('change', (e) =>
    setPermissionsPageSize(e.target.value),
  );
}

function wireSort() {
  createSortableTable({
    container: document.querySelector('#permissionsTable thead'),
    defaultSort: 'service:asc',
    onChange: setPermissionsSort,
  });
}

wireFilters();
wireSort();
bootAdminPage({
  pagePermission: 'page:view_permissions',
  loader: () => {
    ensureServiceFilterOptions();
    loadPermissions(1);
  },
});
