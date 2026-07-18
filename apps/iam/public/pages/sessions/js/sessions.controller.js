import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import {
  goToSessionsPage,
  loadSessions,
  revokeSession,
} from '../../user-management/js/sessions-admin.service.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
  loadSessions,
  goToSessionsPage,
  revokeSession,
});

bootAdminPage({ pagePermission: 'page:view_sessions', loader: () => loadSessions(1) });
