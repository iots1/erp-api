import { createAdminPage } from '../../user-management/js/admin-page.js';
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

createAdminPage({
  pagePermission: 'page:view_permissions',
  globals: {
    openPermissionModal,
    closePermissionModal,
    handlePermissionFormSubmit,
    confirmDeletePermission,
    goToPermissionsPage,
    handleSyncPermissions,
  },
  // The service filter's <option>s are derived from the catalog itself, so
  // they're populated alongside the first page load rather than baked into
  // index.ejs.
  load: () => {
    ensureServiceFilterOptions();
    loadPermissions(1);
  },
  filters: [
    { id: 'permSearchFilter', onChange: (search) => setPermissionsFilter({ search }) },
    {
      id: 'permServiceFilter',
      event: 'change',
      onChange: (service) => setPermissionsFilter({ service }),
    },
    { id: 'permPlaneFilter', event: 'change', onChange: (plane) => setPermissionsFilter({ plane }) },
    {
      id: 'permSourceFilter',
      event: 'change',
      onChange: (source) => setPermissionsFilter({ source }),
    },
  ],
  pageSize: { id: 'permPageSize', set: setPermissionsPageSize },
  sort: { tableId: 'permissionsTable', defaultSort: 'service:asc', set: setPermissionsSort },
});
