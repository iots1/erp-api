import { hasPermission } from '../../../js/login.service.js';
import { iamDelete, iamGet, iamPost, iamPut } from './api.js';
import { ensurePoliciesLoaded } from './policies.service.js';
import { resetRoleFormDraft, state } from './state.js';
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, refreshIcons } from './utils.js';
import { switchView } from './views.service.js';

export async function ensureRolesLoaded(force = false) {
  if (state.rolesLoaded && !force) return state.roles;
  const { items } = await iamGet('/roles', { ignore_limit: true, sort: 'name_th:asc' });
  state.roles = items;
  state.rolesLoaded = true;
  return items;
}

export async function loadRoles() {
  try {
    await ensureRolesLoaded(true);
    renderRolesTable();
  } catch (error) {
    showApiError(error, 'โหลดรายการบทบาทไม่สำเร็จ');
  }
}

function renderRolesTable() {
  const tbody = document.getElementById('roleTableBody');
  if (!tbody) return;

  if (state.roles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="um-empty-cell">ยังไม่มีบทบาทในระบบ</td></tr>`;
    return;
  }

  const canManage = hasPermission('role:update');
  tbody.innerHTML = state.roles
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
        ${canManage ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="openRoleForm('${role.id}', document.getElementById('nav-roles'))"><i data-lucide="edit-3" class="um-icon-sm"></i> แก้ไข</button>` : ''}
        ${canManage ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="confirmDeleteRole('${role.id}', '${escapeHtml(role.code).replace(/'/g, "\\'")}')"><i data-lucide="trash-2" class="um-icon-sm"></i></button>` : ''}
      </td>
    </tr>
  `,
    )
    .join('');
  refreshIcons();
}

// ── Create / edit role view ─────────────────────────────────────

export async function openRoleForm(roleId, navElement) {
  switchView('role-form', navElement);
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
    switchView('roles', document.getElementById('nav-roles'));
    loadRoles();
  } catch (error) {
    showApiError(error, 'บันทึกบทบาทไม่สำเร็จ');
  }
}

export async function confirmDeleteRole(roleId, code) {
  if (!window.confirm(`ยืนยันการลบบทบาท "${code}"?`)) return;
  try {
    await iamDelete(`/roles/${roleId}`);
    showToast('ลบบทบาทสำเร็จ', 'success');
    loadRoles();
  } catch (error) {
    showApiError(error, 'ลบบทบาทไม่สำเร็จ');
  }
}
