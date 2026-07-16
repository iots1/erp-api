import { hasPermission } from '../../../js/login.service.js';
import { iamDelete, iamGet, iamPost, iamPut } from './api.js';
import { ensureRolesLoaded } from './roles.service.js';
import { state } from './state.js';
import { showApiError, showToast } from './toast.service.js';
import { downloadJson, escapeHtml, refreshIcons } from './utils.js';

const STATUS_LABEL = { active: 'Active', pending: 'Pending', suspended: 'Suspended' };

export async function loadUsers(page = 1) {
  try {
    const filter = [];
    if (state.usersQuery.department) {
      filter.push(`department||$cont||${state.usersQuery.department}`);
    }
    const or = state.usersQuery.search
      ? [
          `full_name||$cont||${state.usersQuery.search}`,
          `username||$cont||${state.usersQuery.search}`,
          `email||$cont||${state.usersQuery.search}`,
        ]
      : undefined;

    const { items, pagination } = await iamGet('/users', {
      page,
      limit: 10,
      sort: 'created_at:desc',
      filter,
      or,
    });
    state.users = items;
    state.usersPagination = pagination;
    renderUsersTable();
  } catch (error) {
    showApiError(error, 'โหลดรายชื่อผู้ใช้งานไม่สำเร็จ');
  }
}

export function setUsersFilter({ search, department }) {
  if (search !== undefined) state.usersQuery.search = search.trim();
  if (department !== undefined) state.usersQuery.department = department.trim();
  loadUsers(1);
}

function renderUsersTable() {
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;

  if (state.users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="um-empty-cell">ไม่พบข้อมูลผู้ใช้งาน</td></tr>`;
    return;
  }

  tbody.innerHTML = state.users
    .map((user) => {
      const statusClass = `status-${user.status}`;
      const canEdit = hasPermission('user_account:create');
      return `
      <tr>
        <td>
          <p class="um-cell-title">${escapeHtml(user.full_name)}</p>
          <p class="um-cell-sub">@${escapeHtml(user.username)} · ${escapeHtml(user.email)}</p>
        </td>
        <td>${escapeHtml(user.employee_id)}</td>
        <td>${escapeHtml(user.department ?? '-')}</td>
        <td>
          <button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="openUserRolesModal('${user.id}')">
            <i data-lucide="shield" class="um-icon-sm"></i> จัดการบทบาท
          </button>
        </td>
        <td><span class="status-pill ${statusClass}">${STATUS_LABEL[user.status] ?? user.status}</span></td>
        <td class="um-cell-actions">
          ${canEdit ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="openUserFormModal('${user.id}')"><i data-lucide="edit-3" class="um-icon-sm"></i></button>` : ''}
          ${canEdit ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="confirmDeleteUser('${user.id}', '${escapeHtml(user.full_name).replace(/'/g, "\\'")}')"><i data-lucide="trash-2" class="um-icon-sm"></i></button>` : ''}
        </td>
      </tr>
    `;
    })
    .join('');
  refreshIcons();
}

export function exportUsersJson() {
  downloadJson('users.json', state.users);
  showToast('Export ผู้ใช้งานสำเร็จ', 'success');
}

// ── Add / edit user modal ───────────────────────────────────────

export async function openUserFormModal(userId) {
  const modal = document.getElementById('userFormModal');
  const form = document.getElementById('userForm');
  form.reset();
  form.dataset.editingId = userId ?? '';
  document.getElementById('userFormTitle').textContent = userId
    ? 'แก้ไขบุคลากร'
    : 'เพิ่มบุคลากร';

  if (userId) {
    try {
      const user = await iamGet(`/users/${userId}`);
      document.getElementById('frmUsername').value = user.username;
      document.getElementById('frmEmployeeId').value = user.employee_id;
      document.getElementById('frmFullName').value = user.full_name;
      document.getElementById('frmEmail').value = user.email;
      document.getElementById('frmDepartment').value = user.department ?? '';
      document.getElementById('frmStatus').value = user.status;
    } catch (error) {
      showApiError(error, 'โหลดข้อมูลผู้ใช้งานไม่สำเร็จ');
      return;
    }
  } else {
    document.getElementById('frmStatus').value = 'pending';
  }

  modal.classList.remove('hidden');
}

export function closeUserFormModal() {
  document.getElementById('userFormModal').classList.add('hidden');
}

export async function handleUserFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const editingId = form.dataset.editingId || null;

  const payload = {
    username: document.getElementById('frmUsername').value.trim(),
    employee_id: document.getElementById('frmEmployeeId').value.trim(),
    full_name: document.getElementById('frmFullName').value.trim(),
    email: document.getElementById('frmEmail').value.trim(),
    department: document.getElementById('frmDepartment').value.trim() || null,
    status: document.getElementById('frmStatus').value,
  };

  try {
    if (editingId) {
      await iamPut(`/users/${editingId}`, payload);
      showToast('บันทึกข้อมูลผู้ใช้งานสำเร็จ', 'success');
    } else {
      await iamPost('/users', payload);
      showToast('เพิ่มบุคลากรสำเร็จ', 'success');
    }
    closeUserFormModal();
    loadUsers(state.usersPagination?.page ?? 1);
  } catch (error) {
    showApiError(error, 'บันทึกข้อมูลผู้ใช้งานไม่สำเร็จ');
  }
}

export async function confirmDeleteUser(userId, fullName) {
  if (!window.confirm(`ยืนยันการลบผู้ใช้งาน "${fullName}"?`)) return;
  try {
    await iamDelete(`/users/${userId}`);
    showToast('ลบผู้ใช้งานสำเร็จ', 'success');
    loadUsers(state.usersPagination?.page ?? 1);
  } catch (error) {
    showApiError(error, 'ลบผู้ใช้งานไม่สำเร็จ');
  }
}

// ── Assign roles modal ──────────────────────────────────────────

export async function openUserRolesModal(userId) {
  try {
    await ensureRolesLoaded();
    const { role_ids } = await iamGet(`/users/${userId}/roles`);

    const modal = document.getElementById('userRolesModal');
    const form = document.getElementById('userRolesForm');
    form.dataset.userId = userId;

    document.getElementById('userRolesContainer').innerHTML = state.roles
      .map(
        (role) => `
      <label class="um-checkbox-row">
        <input type="checkbox" name="userRoleIds" value="${role.id}" ${role_ids.includes(role.id) ? 'checked' : ''}>
        <div>
          <span class="um-checkbox-title">${escapeHtml(role.name_th)}</span>
          <span class="um-checkbox-sub">${escapeHtml(role.code)}</span>
        </div>
      </label>
    `,
      )
      .join('');

    modal.classList.remove('hidden');
  } catch (error) {
    showApiError(error, 'โหลดข้อมูลบทบาทไม่สำเร็จ');
  }
}

export function closeUserRolesModal() {
  document.getElementById('userRolesModal').classList.add('hidden');
}

export async function handleAssignRolesSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const userId = form.dataset.userId;
  const roleIds = Array.from(
    form.querySelectorAll('input[name="userRoleIds"]:checked'),
  ).map((input) => input.value);

  try {
    await iamPut(`/users/${userId}/roles`, { role_ids: roleIds });
    showToast('บันทึกบทบาทผู้ใช้งานสำเร็จ', 'success');
    closeUserRolesModal();
  } catch (error) {
    showApiError(error, 'บันทึกบทบาทไม่สำเร็จ');
  }
}
