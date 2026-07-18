import { handleAuthLogin } from '../../../js/auth-guard.service.js';
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

bootAdminPage({ pagePermission: 'page:view_settings' });
