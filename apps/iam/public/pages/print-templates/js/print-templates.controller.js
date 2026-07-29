import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  confirmDeletePrintTemplate,
  goToPrintTemplatesPage,
  handlePrintTemplateFormSubmit,
  initPrintTemplateForm,
  loadPrintTemplates,
  setPrintTemplatesFilter,
  setPrintTemplatesPageSize,
} from '../../user-management/js/print-templates.service.js';
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
  handlePrintTemplateFormSubmit,
  confirmDeletePrintTemplate,
  goToPrintTemplatesPage,
});

function wireFilters() {
  const searchInput = document.getElementById('printTemplateSearchFilter');
  searchInput?.addEventListener(
    'input',
    debounce((e) => setPrintTemplatesFilter({ search: e.target.value }), 350),
  );

  const statusSelect = document.getElementById('printTemplateStatusFilter');
  statusSelect?.addEventListener('change', (e) => setPrintTemplatesFilter({ status: e.target.value }));

  const pageSizeSelect = document.getElementById('printTemplatePageSize');
  pageSizeSelect?.addEventListener('change', (e) => setPrintTemplatesPageSize(e.target.value));
}

// This bundle serves both the print-templates list page (index.ejs) and the
// create/edit form page (form.ejs) — branch on which markup is present
// rather than splitting into two bundles.
const isFormPage = !!document.getElementById('printTemplateForm');

if (isFormPage) {
  bootAdminPage({ pagePermission: 'page:view_print_templates', loader: () => initPrintTemplateForm() });
} else {
  wireFilters();
  bootAdminPage({ pagePermission: 'page:view_print_templates', loader: () => loadPrintTemplates(1) });
}
