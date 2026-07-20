import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  closeAccessKeySecretModal,
  confirmDeleteAccessKey,
  confirmRevokeAccessKey,
  copyFieldToClipboard,
  goToAccessKeysPage,
  handleAccessKeyFormSubmit,
  initAccessKeyForm,
  loadAccessKeys,
  setAccessKeysFilter,
  setAccessKeysPageSize,
  toggleAccessKeyOwnerType,
} from '../../user-management/js/access-keys.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import { debounce } from '../../user-management/js/utils.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
  handleAccessKeyFormSubmit,
  toggleAccessKeyOwnerType,
  closeAccessKeySecretModal,
  copyFieldToClipboard,
  confirmRevokeAccessKey,
  confirmDeleteAccessKey,
  goToAccessKeysPage,
});

function wireFilters() {
  const searchInput = document.getElementById('accessKeySearchFilter');
  searchInput?.addEventListener(
    'input',
    debounce((e) => setAccessKeysFilter({ search: e.target.value }), 350),
  );

  const statusSelect = document.getElementById('accessKeyStatusFilter');
  statusSelect?.addEventListener('change', (e) => setAccessKeysFilter({ status: e.target.value }));

  const pageSizeSelect = document.getElementById('accessKeyPageSize');
  pageSizeSelect?.addEventListener('change', (e) => setAccessKeysPageSize(e.target.value));
}

// This bundle serves both the access-keys list page (index.ejs) and the
// create/edit form page (form.ejs) — each render only their own markup, so
// branch on which one is present rather than splitting into two bundles.
const isFormPage = !!document.getElementById('accessKeyForm');

if (isFormPage) {
  bootAdminPage({ pagePermission: 'page:view_access_keys', loader: () => initAccessKeyForm() });
} else {
  wireFilters();
  bootAdminPage({ pagePermission: 'page:view_access_keys', loader: () => loadAccessKeys(1) });
}
