import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { handleChangePasswordSubmit } from '../../../js/change-password.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import { createSortableTable } from '../../user-management/js/sortable-table.js';
import { debounce } from '../../user-management/js/utils.js';
import {
  closeUserRolesModal,
  closeUserTempPasswordModal,
  confirmDeleteUser,
  copyFieldToClipboard,
  goToUsersPage,
  handleAssignRolesSubmit,
  handleUserFormSubmit,
  initUserForm,
  loadUsers,
  openUserRolesModal,
  setUsersFilter,
  setUsersPageSize,
  setUsersSort,
} from '../../user-management/js/users.service.js';

Object.assign(window, {
  handleAuthLogin,
  handleChangePasswordSubmit,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
  handleUserFormSubmit,
  confirmDeleteUser,
  openUserRolesModal,
  closeUserRolesModal,
  handleAssignRolesSubmit,
  goToUsersPage,
  closeUserTempPasswordModal,
  copyFieldToClipboard,
});

function wireFilters() {
  const searchInput = document.getElementById('filterSearch');
  searchInput?.addEventListener(
    'input',
    debounce((e) => setUsersFilter({ search: e.target.value }), 350),
  );

  const deptInput = document.getElementById('filterDept');
  deptInput?.addEventListener(
    'input',
    debounce((e) => setUsersFilter({ department: e.target.value }), 350),
  );

  const statusSelect = document.getElementById('filterStatus');
  statusSelect?.addEventListener('change', (e) => setUsersFilter({ status: e.target.value }));

  const pageSizeSelect = document.getElementById('usersPageSize');
  pageSizeSelect?.addEventListener('change', (e) => setUsersPageSize(e.target.value));
}

function wireSort() {
  createSortableTable({
    container: document.querySelector('#usersTable thead'),
    defaultSort: 'created_at:desc',
    onChange: setUsersSort,
  });
}

// This bundle serves both the users list page (index.ejs) and the create/edit
// form page (form.ejs) — each render only their own markup, so branch on
// which one is present rather than splitting into two bundles.
const isFormPage = !!document.getElementById('userForm');

if (isFormPage) {
  bootAdminPage({ pagePermission: 'page:view_users', loader: () => initUserForm() });
} else {
  wireFilters();
  wireSort();
  bootAdminPage({ pagePermission: 'page:view_users', loader: () => loadUsers(1) });
}
