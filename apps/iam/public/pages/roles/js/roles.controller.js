import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  confirmDeleteRole,
  handleRoleFormSubmit,
  loadRoles,
  openRoleForm,
} from '../../user-management/js/roles.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import { switchView } from '../../user-management/js/views.service.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
  switchView,
  openRoleForm,
  handleRoleFormSubmit,
  confirmDeleteRole,
});

bootAdminPage({ pagePermission: 'page:view_roles', loader: loadRoles });
