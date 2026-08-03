import { createAdminPage } from '../../user-management/js/admin-page.js';
import {
  closeUserRolesModal,
  closeUserTempPasswordModal,
  confirmDeleteUser,
  confirmResetPassword,
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

createAdminPage({
  pagePermission: 'page:view_users',
  globals: {
    handleUserFormSubmit,
    confirmDeleteUser,
    confirmResetPassword,
    openUserRolesModal,
    closeUserRolesModal,
    handleAssignRolesSubmit,
    goToUsersPage,
    closeUserTempPasswordModal,
    copyFieldToClipboard,
  },
  form: { detectId: 'userForm', init: initUserForm },
  load: () => loadUsers(1),
  filters: [
    { id: 'filterSearch', onChange: (search) => setUsersFilter({ search }) },
    { id: 'filterDept', onChange: (department) => setUsersFilter({ department }) },
    { id: 'filterStatus', event: 'change', onChange: (status) => setUsersFilter({ status }) },
  ],
  pageSize: { id: 'usersPageSize', set: setUsersPageSize },
  sort: { tableId: 'usersTable', defaultSort: 'created_at:desc', set: setUsersSort },
});
