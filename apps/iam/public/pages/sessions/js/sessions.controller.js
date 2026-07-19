import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import {
  goToSessionsPage,
  loadSessions,
  revokeSession,
  setSessionsPageSize,
  setSessionsUserIdFilter,
} from '../../user-management/js/sessions-admin.service.js';
import { debounce } from '../../user-management/js/utils.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
  loadSessions,
  goToSessionsPage,
  revokeSession,
});

function wireFilters() {
  const userIdInput = document.getElementById('sessionUserIdFilter');
  userIdInput?.addEventListener(
    'input',
    debounce((e) => setSessionsUserIdFilter(e.target.value), 350),
  );

  const pageSizeSelect = document.getElementById('sessionsPageSize');
  pageSizeSelect?.addEventListener('change', (e) => setSessionsPageSize(e.target.value));
}

wireFilters();
bootAdminPage({ pagePermission: 'page:view_sessions', loader: () => loadSessions(1) });
