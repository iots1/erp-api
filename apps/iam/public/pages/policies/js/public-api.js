// The ONLY file that touches `window` on the policies page (see
// SKILL.md-style "Complex Page Module Architecture" — this page has a
// multi-step form with dropdown/condition-row logic, hence the dedicated
// public-api.js bridge instead of assigning window at the bottom of a
// single controller file). The shell's own globals and the list/form wiring
// come from createAdminPage, same as every other page.
import { createAdminPage } from '../../user-management/js/admin-page.js';
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
  setActionsDensity,
  setPoliciesFilter,
  setPoliciesPageSize,
  setPoliciesSort,
  setStatementType,
  switchPolicyFormStep,
  syncGroupSelectAll,
  toggleGroupActions,
  toggleMultiDropdown,
  toggleOptionMulti,
  toggleSelectAllMulti,
  updateConditionRow,
} from '../../user-management/js/policies.service.js';

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

/** Close any open multi-select dropdown when clicking outside of it. */
function wireDropdownDismiss() {
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
}

createAdminPage({
  pagePermission: 'page:view_policies',
  globals: {
    confirmDeletePolicy,
    setStatementType,
    switchPolicyFormStep,
    toggleMultiDropdown,
    renderMultiSelect,
    toggleSelectAllMulti,
    toggleOptionMulti,
    selectAllActions,
    setActionsDensity,
    toggleGroupActions,
    syncGroupSelectAll,
    addConditionRow,
    removeConditionRow,
    updateConditionRow,
    addStatementToDraft,
    removeStatementFromDraft,
    goToPoliciesPage,
  },
  form: {
    detectId: 'policyForm',
    init: initPolicyForm,
    onSubmit: handlePolicyFormSubmit,
    wire: () => {
      wirePolicyCodeInput();
      wireDropdownDismiss();
    },
  },
  load: () => loadPolicies(1),
  filters: [
    { id: 'policySearchFilter', onChange: (search) => setPoliciesFilter({ search }) },
    {
      id: 'policyStatusFilter',
      event: 'change',
      onChange: (status) => setPoliciesFilter({ status }),
    },
  ],
  pageSize: { id: 'policyPageSize', set: setPoliciesPageSize },
  sort: { tableId: 'policiesTable', defaultSort: 'name_th:asc', set: setPoliciesSort },
});
