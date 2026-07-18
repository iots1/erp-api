// The ONLY file that touches `window` on the policies page (see
// SKILL.md-style "Complex Page Module Architecture" — this page has a
// multi-step form with dropdown/condition-row logic, hence the dedicated
// public-api.js bridge instead of assigning window at the bottom of a
// single controller file).
import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import {
  addConditionRow,
  addStatementToDraft,
  confirmDeletePolicy,
  handlePolicyFormSubmit,
  loadPolicies,
  openPolicyForm,
  removeConditionRow,
  removeStatementFromDraft,
  renderMultiSelect,
  selectAllActions,
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
import { switchView } from '../../user-management/js/views.service.js';

Object.assign(window, {
  handleAuthLogin,
  handleInitialLoginSubmit,
  handleLogout,
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
});

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
