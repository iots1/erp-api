import { showConfirmDialog } from '../../../js/confirm-dialog.service.js';
import { hasPermission } from '../../../js/login.service.js';
import { closeModal, openModal } from '../../../js/modal.service.js';
import { iamDelete, iamGet, iamPost, iamPut } from './api.js';
import { createPaginatedList } from './paginated-list.js';
import { ensureRolesLoaded } from './roles.service.js';
import { state } from './state.js';
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, refreshIcons } from './utils.js';

const STATUS_LABEL = { active: 'Active', pending: 'Pending', suspended: 'Suspended' };

const pager = createPaginatedList({
  defaultPageSize: 10,
  infoId: 'usersPagerInfo',
  prevId: 'usersPrevBtn',
  nextId: 'usersNextBtn',
  fetchPage: async (page, pageSize) => {
    try {
      const filter = [];
      if (state.usersQuery.department) {
        filter.push(`department||$cont||${state.usersQuery.department}`);
      }
      if (state.usersQuery.status) {
        filter.push(`status||$eq||${state.usersQuery.status}`);
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
        limit: pageSize,
        sort: 'created_at:desc',
        filter,
        or,
      });
      state.users = items;
      renderUsersTable();
      return pagination;
    } catch (error) {
      showApiError(error, 'โหลดรายชื่อผู้ใช้งานไม่สำเร็จ');
      return undefined;
    }
  },
});

export function loadUsers(page = 1) {
  return pager.load(page);
}

export function setUsersFilter({ search, department, status }) {
  if (search !== undefined) state.usersQuery.search = search.trim();
  if (department !== undefined) state.usersQuery.department = department.trim();
  if (status !== undefined) state.usersQuery.status = status;
  pager.load(1);
}

export function setUsersPageSize(size) {
  pager.setPageSize(size);
}

export function goToUsersPage(direction) {
  return pager.goToPage(direction);
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
      if (!user.id) {
        console.warn('User missing id:', user);
        return '';
      }
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

// ── Add / edit user modal ───────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(uuid) {
  return typeof uuid === 'string' && UUID_REGEX.test(uuid);
}

export async function openUserFormModal(userId) {
  const modal = document.getElementById('userFormModal');
  const form = document.getElementById('userForm');
  form.reset();
  form.dataset.editingId = userId ?? '';
  document.getElementById('userFormTitle').textContent = userId
    ? 'แก้ไขบุคลากร'
    : 'เพิ่มบุคลากร';

  if (userId && isValidUuid(userId)) {
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
  } else if (userId && !isValidUuid(userId)) {
    showToast(`Invalid user ID: ${userId}`, 'error');
    return;
  } else {
    document.getElementById('frmStatus').value = 'pending';
  }

  openModal(modal);
}

export function closeUserFormModal() {
  closeModal(document.getElementById('userFormModal'));
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
    loadUsers(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'บันทึกข้อมูลผู้ใช้งานไม่สำเร็จ');
  }
}

export async function confirmDeleteUser(userId, fullName) {
  if (!isValidUuid(userId)) {
    showToast(`Invalid user ID: ${userId}`, 'error');
    return;
  }
  const confirmed = await showConfirmDialog({
    title: 'ลบผู้ใช้งาน',
    message: `ยืนยันการลบผู้ใช้งาน "${fullName}"?`,
    confirmText: 'ลบ',
  });
  if (!confirmed) return;
  try {
    await iamDelete(`/users/${userId}`);
    showToast('ลบผู้ใช้งานสำเร็จ', 'success');
    loadUsers(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'ลบผู้ใช้งานไม่สำเร็จ');
  }
}

// ── Assign roles modal ──────────────────────────────────────────

export async function openUserRolesModal(userId) {
  if (!isValidUuid(userId)) {
    showToast(`Invalid user ID: ${userId}`, 'error');
    return;
  }
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
          <span class="um-checkbox-title">${escapeHtml(role.name?.th)}</span>
          <span class="um-checkbox-sub">${escapeHtml(role.code)}</span>
        </div>
      </label>
    `,
      )
      .join('');

    openModal(modal);
  } catch (error) {
    showApiError(error, 'โหลดข้อมูลบทบาทไม่สำเร็จ');
  }
}

export function closeUserRolesModal() {
  closeModal(document.getElementById('userRolesModal'));
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
