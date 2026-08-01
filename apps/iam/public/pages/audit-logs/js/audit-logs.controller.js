import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { handleChangePasswordSubmit } from '../../../js/change-password.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  goToLoginHistoriesPage,
  loadLoginHistories,
  setLoginHistoriesFilter,
  setLoginHistoriesPageSize,
  setLoginHistoriesSort,
} from '../../user-management/js/login-histories.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import { createSortableTable } from '../../user-management/js/sortable-table.js';
import { debounce } from '../../user-management/js/utils.js';

Object.assign(window, {
  handleAuthLogin,
  handleChangePasswordSubmit,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
  goToLoginHistoriesPage,
});

function wireFilters() {
  const usernameInput = document.getElementById('auditUsernameFilter');
  usernameInput?.addEventListener(
    'input',
    debounce((e) => setLoginHistoriesFilter({ username: e.target.value }), 350),
  );

  const resultSelect = document.getElementById('auditResultFilter');
  resultSelect?.addEventListener('change', (e) =>
    setLoginHistoriesFilter({ result: e.target.value }),
  );

  const pageSizeSelect = document.getElementById('auditLogPageSize');
  pageSizeSelect?.addEventListener('change', (e) => setLoginHistoriesPageSize(e.target.value));
}

function wireSort() {
  createSortableTable({
    container: document.querySelector('#auditLogTable thead'),
    defaultSort: 'logged_in_at:desc',
    onChange: setLoginHistoriesSort,
  });
}

wireFilters();
wireSort();
bootAdminPage({ pagePermission: 'page:view_audit', loader: () => loadLoginHistories(1) });
