import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  confirmDeleteRole,
  goToRolesPage,
  handleRoleFormSubmit,
  initRoleForm,
  loadRoles,
  setRolesFilter,
  setRolesPageSize,
} from '../../user-management/js/roles.service.js';
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
  toggleTheme,
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

// This bundle serves both the roles list page (index.ejs) and the create/edit
// form page (form.ejs) — each render only their own markup, so branch on
// which one is present rather than splitting into two bundles.
const isFormPage = !!document.getElementById('roleForm');

if (isFormPage) {
  bootAdminPage({ pagePermission: 'page:view_roles', loader: () => initRoleForm() });
} else {
  wireFilters();
  bootAdminPage({ pagePermission: 'page:view_roles', loader: () => loadRoles(1) });
}
