import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  confirmDeleteDocumentType,
  generateDocumentTypeTestNumber,
  goToDocumentTypesPage,
  handleDocumentTypeFormSubmit,
  initDocumentTypeForm,
  loadDocumentTypes,
  setDocumentTypesFilter,
  setDocumentTypesPageSize,
  toggleDocumentTypeRunningNumberFields,
} from '../../user-management/js/document-types.service.js';
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
  handleDocumentTypeFormSubmit,
  confirmDeleteDocumentType,
  goToDocumentTypesPage,
  toggleDocumentTypeRunningNumberFields,
  generateDocumentTypeTestNumber,
});

function wireFilters() {
  const searchInput = document.getElementById('documentTypeSearchFilter');
  searchInput?.addEventListener(
    'input',
    debounce((e) => setDocumentTypesFilter({ search: e.target.value }), 350),
  );

  const statusSelect = document.getElementById('documentTypeStatusFilter');
  statusSelect?.addEventListener('change', (e) => setDocumentTypesFilter({ status: e.target.value }));

  const pageSizeSelect = document.getElementById('documentTypePageSize');
  pageSizeSelect?.addEventListener('change', (e) => setDocumentTypesPageSize(e.target.value));
}

// This bundle serves both the document-types list page (index.ejs) and the
// create/edit form page (form.ejs) — branch on which markup is present
// rather than splitting into two bundles.
const isFormPage = !!document.getElementById('documentTypeForm');

if (isFormPage) {
  bootAdminPage({ pagePermission: 'page:view_document_types', loader: () => initDocumentTypeForm() });
} else {
  wireFilters();
  bootAdminPage({ pagePermission: 'page:view_document_types', loader: () => loadDocumentTypes(1) });
}
