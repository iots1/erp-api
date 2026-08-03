import { createAdminPage } from '../../user-management/js/admin-page.js';
import {
  goToLoginHistoriesPage,
  loadLoginHistories,
  setLoginHistoriesFilter,
  setLoginHistoriesPageSize,
  setLoginHistoriesSort,
} from '../../user-management/js/login-histories.service.js';

createAdminPage({
  pagePermission: 'page:view_audit',
  globals: { goToLoginHistoriesPage },
  load: () => loadLoginHistories(1),
  filters: [
    { id: 'auditUsernameFilter', onChange: (username) => setLoginHistoriesFilter({ username }) },
    {
      id: 'auditResultFilter',
      event: 'change',
      onChange: (result) => setLoginHistoriesFilter({ result }),
    },
  ],
  pageSize: { id: 'auditLogPageSize', set: setLoginHistoriesPageSize },
  sort: { tableId: 'auditLogTable', defaultSort: 'logged_in_at:desc', set: setLoginHistoriesSort },
});
