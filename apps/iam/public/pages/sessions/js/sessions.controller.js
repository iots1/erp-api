import { createAdminPage } from '../../user-management/js/admin-page.js';
import {
  goToSessionsPage,
  loadSessions,
  revokeSession,
  setSessionsPageSize,
  setSessionsUserIdFilter,
} from '../../user-management/js/sessions-admin.service.js';

createAdminPage({
  pagePermission: 'page:view_sessions',
  globals: { loadSessions, goToSessionsPage, revokeSession },
  load: () => loadSessions(1),
  // No `sort` — sessions come from Redis keys, not a sortable query.
  filters: [{ id: 'sessionUserIdFilter', onChange: setSessionsUserIdFilter }],
  pageSize: { id: 'sessionsPageSize', set: setSessionsPageSize },
});
