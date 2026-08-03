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
  setAccessKeysSort,
  toggleAccessKeyOwnerType,
} from '../../user-management/js/access-keys.service.js';
import { createAdminPage } from '../../user-management/js/admin-page.js';

createAdminPage({
  pagePermission: 'page:view_access_keys',
  globals: {
    handleAccessKeyFormSubmit,
    toggleAccessKeyOwnerType,
    closeAccessKeySecretModal,
    copyFieldToClipboard,
    confirmRevokeAccessKey,
    confirmDeleteAccessKey,
    goToAccessKeysPage,
  },
  form: { detectId: 'accessKeyForm', init: initAccessKeyForm },
  load: () => loadAccessKeys(1),
  filters: [
    { id: 'accessKeySearchFilter', onChange: (search) => setAccessKeysFilter({ search }) },
    {
      id: 'accessKeyStatusFilter',
      event: 'change',
      onChange: (status) => setAccessKeysFilter({ status }),
    },
  ],
  pageSize: { id: 'accessKeyPageSize', set: setAccessKeysPageSize },
  sort: { tableId: 'accessKeysTable', defaultSort: 'created_at:desc', set: setAccessKeysSort },
});
