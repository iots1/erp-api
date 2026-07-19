import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import { debounce } from '../../user-management/js/utils.js';
import {
  closeUserFormModal,
  closeUserRolesModal,
  confirmDeleteUser,
  goToUsersPage,
  handleAssignRolesSubmit,
  handleUserFormSubmit,
  loadUsers,
  openUserFormModal,
  openUserRolesModal,
  setUsersFilter,
  setUsersPageSize,
} from '../../user-management/js/users.service.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
  openUserFormModal,
  closeUserFormModal,
  handleUserFormSubmit,
  confirmDeleteUser,
  openUserRolesModal,
  closeUserRolesModal,
  handleAssignRolesSubmit,
  goToUsersPage,
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

wireFilters();
bootAdminPage({ pagePermission: 'page:view_users', loader: () => loadUsers(1) });
