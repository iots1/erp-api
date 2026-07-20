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
  initPolicyForm,
  loadPolicies,
  removeConditionRow,
  removeStatementFromDraft,
  renderMultiSelect,
  selectAllActions,
  setPoliciesFilter,
  setPoliciesPageSize,
  setStatementType,
  syncGroupSelectAll,
  toggleGroupActions,
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

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
  toggleTheme,
  confirmDeletePolicy,
  setStatementType,
  toggleMultiDropdown,
  renderMultiSelect,
  toggleSelectAllMulti,
  toggleOptionMulti,
  selectAllActions,
  toggleGroupActions,
  syncGroupSelectAll,
  addConditionRow,
  removeConditionRow,
  updateConditionRow,
  addStatementToDraft,
  removeStatementFromDraft,
  handlePolicyFormSubmit,
  goToPoliciesPage,
});

// frmPolCode only accepts A-Z, 0-9 and `_`, and always keeps the POL_ prefix
// (the user cannot delete it, matching the fixed-namespace convention for
// policy codes). Suffix is derived from whatever comes after the prefix
// rather than blindly re-concatenated, so backspacing into the prefix
// (e.g. "POL_" -> "POL") collapses back to "POL_" instead of doubling up
// into "POL_POL_".
const POL_CODE_PREFIX = 'POL_';

function wirePolicyCodeInput() {
  const codeInput = document.getElementById('frmPolCode');
  codeInput?.addEventListener('input', () => {
    const raw = codeInput.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    let suffix;
    if (raw.startsWith(POL_CODE_PREFIX)) {
      suffix = raw.slice(POL_CODE_PREFIX.length);
    } else if (POL_CODE_PREFIX.startsWith(raw)) {
      suffix = '';
    } else {
      suffix = raw;
    }
    codeInput.value = POL_CODE_PREFIX + suffix;
  });
}

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

// This bundle serves both the policies list page (index.ejs) and the
// create/edit policy-generator form page (form.ejs) — each render only their
// own markup, so branch on which one is present rather than splitting into
// two bundles.
const isFormPage = !!document.getElementById('policyForm');

if (isFormPage) {
  wirePolicyCodeInput();

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

  bootAdminPage({ pagePermission: 'page:view_policies', loader: () => initPolicyForm() });
} else {
  wireFilters();
  bootAdminPage({ pagePermission: 'page:view_policies', loader: loadPolicies });
}
