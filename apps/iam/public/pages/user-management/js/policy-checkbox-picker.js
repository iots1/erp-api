// Shared "attach policies" checkbox grid — used by both the role form and
// the access-key form (roles.service.js / access-keys.service.js), which
// used to each hand-roll an identical render function. Adds an optional
// client-side search box on top (state.policies is already fully loaded via
// ensurePoliciesLoaded(), so filtering here is just an Array.filter, no
// re-fetch).
//
// Selection is tracked by mutating the caller's own array in place (via
// each checkbox's change event), not by reading `:checked` out of the DOM
// at submit time — because the search box re-renders (replaces) the grid's
// innerHTML on every keystroke, which would otherwise silently drop the
// checked state of any policy currently filtered out of view.
import { state } from './state.js';
import { escapeHtml, refreshIcons } from './utils.js';

/**
 * @param {{
 *   containerId: string,
 *   inputName: string,
 *   getSelectedIds: () => string[],
 *   searchInputId?: string,
 * }} config
 * @returns {{ render: () => void }}
 */
export function createPolicyCheckboxPicker({ containerId, inputName, getSelectedIds, searchInputId }) {
  let searchTerm = '';

  function toggleSelected(policyId, isChecked) {
    const selectedIds = getSelectedIds();
    const index = selectedIds.indexOf(policyId);
    if (isChecked && index === -1) selectedIds.push(policyId);
    else if (!isChecked && index !== -1) selectedIds.splice(index, 1);
  }

  function matchesSearch(policy, term) {
    return (
      (policy.name?.th ?? '').toLowerCase().includes(term) ||
      (policy.name?.en ?? '').toLowerCase().includes(term) ||
      (policy.code ?? '').toLowerCase().includes(term)
    );
  }

  function render() {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (state.policies.length === 0) {
      container.innerHTML = `<p class="um-muted-note">ยังไม่มี Policy ในระบบ — ไปสร้างที่หน้า "นโยบายความปลอดภัย" ก่อน</p>`;
      return;
    }

    const term = searchTerm.trim().toLowerCase();
    const filtered = term ? state.policies.filter((policy) => matchesSearch(policy, term)) : state.policies;

    if (filtered.length === 0) {
      container.innerHTML = `<p class="um-muted-note">ไม่พบ Policy ที่ตรงกับ "${escapeHtml(searchTerm.trim())}"</p>`;
      return;
    }

    const selectedIds = getSelectedIds();
    container.innerHTML = filtered
      .map(
        (policy) => `
      <label class="um-checkbox-card">
        <input type="checkbox" name="${inputName}" value="${policy.id}" ${selectedIds.includes(policy.id) ? 'checked' : ''}>
        <div>
          <span class="um-checkbox-title">${escapeHtml(policy.name?.th)}</span>
          <span class="um-checkbox-sub">${escapeHtml(policy.code)}</span>
          <span class="p-tag ${policy.is_active ? 'p-tag-mint' : 'p-tag-pink'}">${policy.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      </label>
    `,
      )
      .join('');

    container.querySelectorAll(`input[name="${inputName}"]`).forEach((input) => {
      input.addEventListener('change', (event) => toggleSelected(event.target.value, event.target.checked));
    });
    refreshIcons();
  }

  document.getElementById(searchInputId)?.addEventListener('input', (event) => {
    searchTerm = event.target.value;
    render();
  });

  return { render };
}
