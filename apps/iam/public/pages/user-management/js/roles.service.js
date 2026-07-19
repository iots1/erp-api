import { showConfirmDialog } from '../../../js/confirm-dialog.service.js';
import { hasPermission } from '../../../js/login.service.js';
import { iamDelete, iamGet, iamPost, iamPut } from './api.js';
import { createPaginatedList } from './paginated-list.js';
import { ensurePoliciesLoaded } from './policies.service.js';
import { resetRoleFormDraft, state } from './state.js';
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, refreshIcons } from './utils.js';
import { switchView } from './views.service.js';

// Full, un-paginated list — cached for consumers that need every role at
// once (the "assign roles" checkbox grid in users.service.js), independent
// of the roles *index page*'s own paginated/filtered table below.
export async function ensureRolesLoaded(force = false) {
  if (state.rolesLoaded && !force) return state.roles;
  const { items } = await iamGet('/roles', { ignore_limit: true, sort: 'name_th:asc' });
  state.roles = items;
  state.rolesLoaded = true;
  return items;
}

// ── Roles index table — search + pagination, mirrors permissions/users ──

const query = { search: '' };
let currentItems = [];

const pager = createPaginatedList({
  defaultPageSize: 20,
  infoId: 'rolesPagerInfo',
  prevId: 'rolesPrevBtn',
  nextId: 'rolesNextBtn',
  fetchPage: async (page, pageSize) => {
    try {
      const or = query.search
        ? [
            `code||$cont||${query.search}`,
            `name_th||$cont||${query.search}`,
            `name_en||$cont||${query.search}`,
          ]
        : undefined;

      const { items, pagination } = await iamGet('/roles', {
        page,
        limit: pageSize,
        sort: 'name_th:asc',
        or,
      });
      currentItems = items;
      renderRolesTable();
      return pagination;
    } catch (error) {
      showApiError(error, 'โหลดรายการบทบาทไม่สำเร็จ');
      return undefined;
    }
  },
});

export function loadRoles(page = 1) {
  return pager.load(page);
}

export function setRolesFilter({ search }) {
  if (search !== undefined) query.search = search.trim();
  pager.load(1);
}

export function setRolesPageSize(size) {
  pager.setPageSize(size);
}

export function goToRolesPage(direction) {
  return pager.goToPage(direction);
}

function renderRolesTable() {
  const tbody = document.getElementById('roleTableBody');
  if (!tbody) return;

  if (currentItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="um-empty-cell">ไม่พบบทบาทที่ตรงกับเงื่อนไข</td></tr>`;
    return;
  }

  const canManage = hasPermission('role:update');
  tbody.innerHTML = currentItems
    .map(
      (role) => `
    <tr>
      <td>
        <p class="um-cell-title">${escapeHtml(role.code)}</p>
        <p class="um-cell-sub">${escapeHtml(role.name?.th)} / ${escapeHtml(role.name?.en)}</p>
      </td>
      <td>${escapeHtml(role.description ?? '-')}</td>
      <td class="um-cell-mono">${role.id}</td>
      <td class="um-cell-actions">
        ${canManage ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="openRoleForm('${role.id}')"><i data-lucide="edit-3" class="um-icon-sm"></i> แก้ไข</button>` : ''}
        ${canManage ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="confirmDeleteRole('${role.id}', '${escapeHtml(role.code).replace(/'/g, "\\'")}')"><i data-lucide="trash-2" class="um-icon-sm"></i></button>` : ''}
      </td>
    </tr>
  `,
    )
    .join('');
  refreshIcons();
}

// ── Create / edit role view ─────────────────────────────────────

export async function openRoleForm(roleId) {
  switchView('role-form');
  resetRoleFormDraft();

  const form = document.getElementById('roleForm');
  form.reset();
  form.dataset.editingId = roleId ?? '';
  document.getElementById('roleFormTitle').textContent = roleId
    ? 'แก้ไขบทบาท (Edit Role)'
    : 'สร้างบทบาทใหม่ (Create Role)';

  try {
    await ensurePoliciesLoaded();

    if (roleId) {
      const [role, { policy_ids }] = await Promise.all([
        iamGet(`/roles/${roleId}`),
        iamGet(`/roles/${roleId}/policies`),
      ]);
      document.getElementById('frmRoleCode').value = role.code;
      document.getElementById('frmRoleNameTh').value = role.name?.th ?? '';
      document.getElementById('frmRoleNameEn').value = role.name?.en ?? '';
      document.getElementById('frmRoleDescription').value = role.description ?? '';
      state.roleForm.selectedPolicyIds = policy_ids;
    }

    renderRolePolicyCheckboxes();
  } catch (error) {
    showApiError(error, 'โหลดข้อมูลบทบาทไม่สำเร็จ');
  }
}

function renderRolePolicyCheckboxes() {
  const container = document.getElementById('rolePoliciesContainer');
  if (state.policies.length === 0) {
    container.innerHTML = `<p class="um-muted-note">ยังไม่มี Policy ในระบบ — ไปสร้างที่หน้า "นโยบายความปลอดภัย" ก่อน</p>`;
    return;
  }

  container.innerHTML = state.policies
    .map(
      (policy) => `
    <label class="um-checkbox-card">
      <input type="checkbox" name="rolePolicyIds" value="${policy.id}" ${state.roleForm.selectedPolicyIds.includes(policy.id) ? 'checked' : ''}>
      <div>
        <span class="um-checkbox-title">${escapeHtml(policy.name?.th)}</span>
        <span class="um-checkbox-sub">${escapeHtml(policy.code)}</span>
        <span class="p-tag ${policy.is_active ? 'p-tag-mint' : 'p-tag-pink'}">${policy.is_active ? 'Active' : 'Inactive'}</span>
      </div>
    </label>
  `,
    )
    .join('');
}

export async function handleRoleFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const editingId = form.dataset.editingId || null;

  const payload = {
    code: document.getElementById('frmRoleCode').value.trim().toUpperCase(),
    name_th: document.getElementById('frmRoleNameTh').value.trim(),
    name_en: document.getElementById('frmRoleNameEn').value.trim(),
    description: document.getElementById('frmRoleDescription').value.trim() || null,
  };
  const policyIds = Array.from(
    form.querySelectorAll('input[name="rolePolicyIds"]:checked'),
  ).map((input) => input.value);

  try {
    const role = editingId
      ? await iamPut(`/roles/${editingId}`, payload)
      : await iamPost('/roles', payload);
    await iamPut(`/roles/${role.id}/policies`, { policy_ids: policyIds });

    showToast('บันทึกบทบาทสำเร็จ', 'success');
    switchView('roles');
    loadRoles(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'บันทึกบทบาทไม่สำเร็จ');
  }
}

export async function confirmDeleteRole(roleId, code) {
  const confirmed = await showConfirmDialog({
    title: 'ลบบทบาท',
    message: `ยืนยันการลบบทบาท "${code}"?`,
    confirmText: 'ลบ',
  });
  if (!confirmed) return;
  try {
    await iamDelete(`/roles/${roleId}`);
    showToast('ลบบทบาทสำเร็จ', 'success');
    loadRoles(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'ลบบทบาทไม่สำเร็จ');
  }
}
