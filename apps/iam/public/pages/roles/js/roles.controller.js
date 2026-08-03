import { createAdminPage } from '../../user-management/js/admin-page.js';
import {
  confirmDeleteRole,
  goToRolesPage,
  handleRoleFormSubmit,
  initRoleForm,
  loadRoles,
  setRolesFilter,
  setRolesPageSize,
  setRolesSort,
} from '../../user-management/js/roles.service.js';

createAdminPage({
  pagePermission: 'page:view_roles',
  globals: {
    handleRoleFormSubmit,
    confirmDeleteRole,
    goToRolesPage,
  },
  form: { detectId: 'roleForm', init: initRoleForm },
  load: () => loadRoles(1),
  filters: [{ id: 'roleSearchFilter', onChange: (search) => setRolesFilter({ search }) }],
  pageSize: { id: 'rolePageSize', set: setRolesPageSize },
  sort: { tableId: 'rolesTable', defaultSort: 'name_th:asc', set: setRolesSort },
});
