import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { loadDashboard } from '../../user-management/js/dashboard.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
});

bootAdminPage({ pagePermission: 'page:view_dashboard', loader: loadDashboard });
