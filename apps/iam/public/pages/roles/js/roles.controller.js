import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  confirmDeleteRole,
  goToRolesPage,
  handleRoleFormSubmit,
  loadRoles,
  openRoleForm,
  setRolesFilter,
  setRolesPageSize,
} from '../../user-management/js/roles.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import { debounce } from '../../user-management/js/utils.js';
import { switchView } from '../../user-management/js/views.service.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
  switchView,
  openRoleForm,
  handleRoleFormSubmit,
  confirmDeleteRole,
  goToRolesPage,
});

function wireFilters() {
  const searchInput = document.getElementById('roleSearchFilter');
  searchInput?.addEventListener(
    'input',
    debounce((e) => setRolesFilter({ search: e.target.value }), 350),
  );

  const pageSizeSelect = document.getElementById('rolePageSize');
  pageSizeSelect?.addEventListener('change', (e) => setRolesPageSize(e.target.value));
}

wireFilters();
bootAdminPage({ pagePermission: 'page:view_roles', loader: () => loadRoles(1) });
