import { createAdminPage } from '../../user-management/js/admin-page.js';
import {
  confirmDeleteDocumentType,
  generateDocumentTypeTestNumber,
  goToDocumentTypesPage,
  handleDocumentTypeFormSubmit,
  initDocumentTypeForm,
  loadDocumentTypes,
  setDocumentTypesFilter,
  setDocumentTypesPageSize,
  setDocumentTypesSort,
  toggleDocumentTypeRunningNumberFields,
} from '../../user-management/js/document-types.service.js';

createAdminPage({
  pagePermission: 'page:view_document_types',
  globals: {
    confirmDeleteDocumentType,
    goToDocumentTypesPage,
    toggleDocumentTypeRunningNumberFields,
    generateDocumentTypeTestNumber,
  },
  form: {
    detectId: 'documentTypeForm',
    init: initDocumentTypeForm,
    onSubmit: handleDocumentTypeFormSubmit,
  },
  load: () => loadDocumentTypes(1),
  filters: [
    { id: 'documentTypeSearchFilter', onChange: (search) => setDocumentTypesFilter({ search }) },
    {
      id: 'documentTypeStatusFilter',
      event: 'change',
      onChange: (status) => setDocumentTypesFilter({ status }),
    },
  ],
  pageSize: { id: 'documentTypePageSize', set: setDocumentTypesPageSize },
  sort: {
    tableId: 'documentTypesTable',
    defaultSort: 'created_at:desc',
    set: setDocumentTypesSort,
  },
});
