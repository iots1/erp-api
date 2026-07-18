import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import {
  closePermissionModal,
  confirmDeletePermission,
  goToPermissionsPage,
  handlePermissionFormSubmit,
  loadPermissions,
  openPermissionModal,
  setPermissionsFilter,
} from '../../user-management/js/permissions-admin.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import { debounce } from '../../user-management/js/utils.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
  openPermissionModal,
  closePermissionModal,
  handlePermissionFormSubmit,
  confirmDeletePermission,
  goToPermissionsPage,
});

function wireFilters() {
  const searchInput = document.getElementById('permSearchFilter');
  searchInput?.addEventListener(
    'input',
    debounce((e) => setPermissionsFilter({ search: e.target.value }), 350),
  );

  const planeSelect = document.getElementById('permPlaneFilter');
  planeSelect?.addEventListener('change', (e) =>
    setPermissionsFilter({ plane: e.target.value }),
  );

  const sourceSelect = document.getElementById('permSourceFilter');
  sourceSelect?.addEventListener('change', (e) =>
    setPermissionsFilter({ source: e.target.value }),
  );
}

wireFilters();
bootAdminPage({ pagePermission: 'page:view_permissions', loader: () => loadPermissions(1) });
