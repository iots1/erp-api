import { showConfirmDialog } from '../../../js/confirm-dialog.service.js';
import { hasPermission } from '../../../js/login.service.js';
import { iamDelete, iamGet, iamPost, iamPut } from './api.js';
import { createPaginatedList } from './paginated-list.js';
import { ensurePoliciesLoaded } from './policies.service.js';
import { resetRoleFormDraft, state } from './state.js';
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, refreshIcons } from './utils.js';

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

      const [{ items, pagination }] = await Promise.all([
        iamGet('/roles', {
          page,
          limit: pageSize,
          sort: 'name_th:asc',
          or,
        }),
        ensurePoliciesLoaded(),
      ]);

      const policiesByRole = await Promise.all(
        items.map((role) => iamGet(`/roles/${role.id}/policies`)),
      );
      currentItems = items.map((role, index) => ({
        ...role,
        policyNames: policiesByRole[index].policy_ids
          .map((policyId) => state.policies.find((policy) => policy.id === policyId)?.code)
          .filter(Boolean),
      }));
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
      <td>${
        role.policyNames.length > 0
          ? role.policyNames.map((code) => `<span class="p-tag p-tag-sky">${escapeHtml(code)}</span>`).join(' ')
          : '<span class="um-muted-note">-</span>'
      }</td>
      <td class="um-cell-actions">
        ${canManage ? `<a href="${window.__IAM_VIEWS_BASE__}/roles/${role.id}/edit" class="p-btn p-btn-ghost p-btn-sm"><i data-lucide="edit-3" class="um-icon-sm"></i> แก้ไข</a>` : ''}
        ${canManage ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="confirmDeleteRole('${role.id}', '${escapeHtml(role.code).replace(/'/g, "\\'")}')"><i data-lucide="trash-2" class="um-icon-sm"></i></button>` : ''}
      </td>
    </tr>
  `,
    )
    .join('');
  refreshIcons();
}

// ── Create / edit role form page (apps/iam/views/pages/roles/form.ejs) ──

export async function initRoleForm() {
  const form = document.getElementById('roleForm');
  if (!form) return;

  resetRoleFormDraft();

  const roleId = document.getElementById('view-role-form').dataset.roleId || null;
  form.dataset.editingId = roleId ?? '';
  const codeField = document.getElementById('frmRoleCode');
  codeField.disabled = !!roleId;

  try {
    await ensurePoliciesLoaded();

    if (roleId) {
      const [role, { policy_ids }] = await Promise.all([
        iamGet(`/roles/${roleId}`),
        iamGet(`/roles/${roleId}/policies`),
      ]);
      codeField.value = role.code;
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

  let code = document.getElementById('frmRoleCode').value.trim().toUpperCase();

  if (!editingId && !code.startsWith('ROLE_')) {
    showToast('รหัสบทบาทต้องขึ้นต้นด้วย ROLE_', 'error');
    return;
  }

  const payload = {
    code,
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
    window.location.href = `${window.__IAM_VIEWS_BASE__}/roles`;
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
