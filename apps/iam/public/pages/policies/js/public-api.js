// The ONLY file that touches `window` on the policies page (see
// SKILL.md-style "Complex Page Module Architecture" — this page has a
// multi-step form with dropdown/condition-row logic, hence the dedicated
// public-api.js bridge instead of assigning window at the bottom of a
// single controller file).
import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  addConditionRow,
  addStatementToDraft,
  confirmDeletePolicy,
  goToPoliciesPage,
  handlePolicyFormSubmit,
  loadPolicies,
  openPolicyForm,
  removeConditionRow,
  removeStatementFromDraft,
  renderMultiSelect,
  selectAllActions,
  setPoliciesFilter,
  setPoliciesPageSize,
  setStatementType,
  toggleMultiDropdown,
  toggleOptionMulti,
  toggleSelectAllMulti,
  updateConditionRow,
} from '../../user-management/js/policies.service.js';
import {
  bootAdminPage,
  handleInitialLoginSubmit,
  handleLogout,
} from '../../user-management/js/shell.service.js';
import { debounce } from '../../user-management/js/utils.js';
import { switchView } from '../../user-management/js/views.service.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
  switchView,
  openPolicyForm,
  confirmDeletePolicy,
  setStatementType,
  toggleMultiDropdown,
  renderMultiSelect,
  toggleSelectAllMulti,
  toggleOptionMulti,
  selectAllActions,
  addConditionRow,
  removeConditionRow,
  updateConditionRow,
  addStatementToDraft,
  removeStatementFromDraft,
  handlePolicyFormSubmit,
  goToPoliciesPage,
});

function wireFilters() {
  const searchInput = document.getElementById('policySearchFilter');
  searchInput?.addEventListener(
    'input',
    debounce((e) => setPoliciesFilter({ search: e.target.value }), 350),
  );

  const statusSelect = document.getElementById('policyStatusFilter');
  statusSelect?.addEventListener('change', (e) => setPoliciesFilter({ status: e.target.value }));

  const pageSizeSelect = document.getElementById('policyPageSize');
  pageSizeSelect?.addEventListener('change', (e) => setPoliciesPageSize(e.target.value));
}

wireFilters();

// Close dropdowns when clicking outside them
document.addEventListener('click', (event) => {
  const isDropdownTrigger = event.target.closest('.um-dropdown-trigger');
  const isDropdown = event.target.closest('.um-multi-dropdown');
  const isDropdownSearch = event.target.closest('.um-dropdown-search');
  const isCheckbox = event.target.closest('.um-dropdown-option');

  if (!isDropdownTrigger && !isDropdown && !isDropdownSearch && !isCheckbox) {
    document.querySelectorAll('.um-multi-dropdown').forEach((dropdown) => {
      dropdown.classList.add('hidden');
    });
  }
});

bootAdminPage({ pagePermission: 'page:view_policies', loader: loadPolicies });
