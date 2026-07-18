import { handleAuthLogin } from '../../../js/auth-guard.service.js';
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
  exportUsersJson,
  handleAssignRolesSubmit,
  handleUserFormSubmit,
  loadUsers,
  openUserFormModal,
  openUserRolesModal,
  setUsersFilter,
} from '../../user-management/js/users.service.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
  openUserFormModal,
  closeUserFormModal,
  handleUserFormSubmit,
  confirmDeleteUser,
  exportUsersJson,
  openUserRolesModal,
  closeUserRolesModal,
  handleAssignRolesSubmit,
});

function wireFilters() {
  const searchInput = document.getElementById('globalSearch');
  searchInput?.addEventListener(
    'input',
    debounce((e) => setUsersFilter({ search: e.target.value }), 350),
  );

  const deptInput = document.getElementById('filterDept');
  deptInput?.addEventListener(
    'input',
    debounce((e) => setUsersFilter({ department: e.target.value }), 350),
  );
}

wireFilters();
bootAdminPage({ pagePermission: 'page:view_users', loader: () => loadUsers(1) });
