import { hasPermission } from '../../../js/login.service.js';
import { closeModal, openModal } from '../../../js/modal.service.js';
import { copyFieldToClipboard } from './access-keys.service.js';
import { iamDelete, iamGet, iamPost, iamPut } from './api.js';
import { confirmAndRun } from './confirm-action.js';
import { createPaginatedList } from './paginated-list.js';
import { ensureRolesLoaded } from './roles.service.js';
import { state } from './state.js';
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, refreshIcons } from './utils.js';

export { copyFieldToClipboard };

const STATUS_LABEL = { active: 'Active', pending: 'Pending', suspended: 'Suspended' };

let sort = 'created_at:desc';

const pager = createPaginatedList({
  defaultPageSize: 10,
  infoId: 'usersPagerInfo',
  prevId: 'usersPrevBtn',
  nextId: 'usersNextBtn',
  tbodyId: 'userTableBody',
  columnCount: 6,
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
        sort,
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

export function setUsersSort(newSort) {
  sort = newSort;
  pager.load(1);
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
      const canResetPassword = hasPermission('user_account:reset_password');
      return `
      <tr>
        <td>
          <p class="um-cell-title">${escapeHtml(user.full_name)}</p>
          <p class="um-cell-sub">@${escapeHtml(user.username)} · ${escapeHtml(user.email)}</p>
        </td>
        <td>${escapeHtml(user.employee_id)}</td>
        <td>${escapeHtml(user.department ?? '-')}</td>
        <td>
          <button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="openUserRolesModal('${user.id}')" title="จัดการบทบาท">
            <i data-lucide="shield" class="um-icon-sm"></i> จัดการบทบาท
          </button>
        </td>
        <td><span class="status-pill ${statusClass}">${STATUS_LABEL[user.status] ?? user.status}</span></td>
        <td class="um-cell-actions">
          ${canEdit ? `<a href="${window.__IAM_VIEWS_BASE__}/users/${user.id}/edit" class="p-btn p-btn-ghost p-btn-ghost-primary p-btn-sm" title="แก้ไข"><i data-lucide="edit-3" class="um-icon-sm"></i></a>` : ''}
          ${canResetPassword ? `<button type="button" class="p-btn p-btn-ghost p-btn-ghost-warning p-btn-sm" onclick="confirmResetPassword('${user.id}', '${escapeHtml(user.full_name).replace(/'/g, "\\'")}')" title="รีเซ็ตรหัสผ่าน"><i data-lucide="key-round" class="um-icon-sm"></i></button>` : ''}
          ${canEdit ? `<button type="button" class="p-btn p-btn-ghost p-btn-ghost-danger p-btn-sm" onclick="confirmDeleteUser('${user.id}', '${escapeHtml(user.full_name).replace(/'/g, "\\'")}')" title="ลบ"><i data-lucide="trash-2" class="um-icon-sm"></i></button>` : ''}
        </td>
      </tr>
    `;
    })
    .join('');
  refreshIcons();
}

// ── Create / edit user form page (apps/iam/views/pages/users/form.ejs) ──

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(uuid) {
  return typeof uuid === 'string' && UUID_REGEX.test(uuid);
}

export async function initUserForm() {
  const form = document.getElementById('userForm');
  if (!form) return;

  const userId = document.getElementById('view-user-form').dataset.userId || null;
  form.dataset.editingId = userId ?? '';

  if (!userId) {
    document.getElementById('frmStatus').value = 'pending';
    return;
  }

  try {
    const user = await iamGet(`/users/${userId}`);
    document.getElementById('frmUsername').value = user.username;
    document.getElementById('frmEmployeeId').value = user.employee_id;
    document.getElementById('frmFullName').value = user.full_name;
    document.getElementById('frmEmail').value = user.email ?? '';
    document.getElementById('frmDepartment').value = user.department ?? '';
    document.getElementById('frmStatus').value = user.status;
    document.getElementById('frmExpiredAt').value = user.expired_at?.slice(0, 10) ?? '';
  } catch (error) {
    showApiError(error, 'โหลดข้อมูลผู้ใช้งานไม่สำเร็จ');
  }
}

export async function handleUserFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const editingId = form.dataset.editingId || null;

  const payload = {
    username: document.getElementById('frmUsername').value.trim(),
    employee_id: document.getElementById('frmEmployeeId').value.trim(),
    full_name: document.getElementById('frmFullName').value.trim(),
    email: document.getElementById('frmEmail').value.trim() || null,
    department: document.getElementById('frmDepartment').value.trim() || null,
    status: document.getElementById('frmStatus').value,
    expired_at: document.getElementById('frmExpiredAt').value || null,
  };

  try {
    if (editingId) {
      await iamPut(`/users/${editingId}`, payload);
      showToast('บันทึกข้อมูลผู้ใช้งานสำเร็จ', 'success');
      window.location.href = `${window.__IAM_VIEWS_BASE__}/users`;
    } else {
      const created = await iamPost('/users', payload);
      // Stay on this page — the temp password only ever appears in this one
      // create response, so the reveal modal opens here rather than after
      // navigating back to the list. Closing the modal is what actually
      // returns the user to the list (see closeUserTempPasswordModal).
      openUserTempPasswordModal(created.username, created.temp_password);
    }
  } catch (error) {
    showApiError(error, 'บันทึกข้อมูลผู้ใช้งานไม่สำเร็จ');
  }
}

// ── Temp password reveal modal — shown exactly once, right after creation
// or an admin password reset ──

export function openUserTempPasswordModal(username, tempPassword, titleText) {
  document.getElementById('userTempPasswordModalTitle').textContent =
    titleText ?? 'เพิ่มบุคลากรสำเร็จ';
  document.getElementById('tempPasswordModalUsername').value = username;
  document.getElementById('tempPasswordModalPassword').value = tempPassword;
  openModal(document.getElementById('userTempPasswordModal'));
}

export function closeUserTempPasswordModal() {
  const modal = document.getElementById('userTempPasswordModal');
  closeModal(modal);
  // The password only ever lives in this modal's inputs for as long as it's
  // open — clear it immediately on close so it doesn't linger in the DOM.
  document.getElementById('tempPasswordModalUsername').value = '';
  document.getElementById('tempPasswordModalPassword').value = '';
  window.location.href = `${window.__IAM_VIEWS_BASE__}/users`;
}

export function confirmResetPassword(userId, fullName) {
  if (!isValidUuid(userId)) {
    showToast(`Invalid user ID: ${userId}`, 'error');
    return;
  }
  // No `successMessage` — the temp-password modal below *is* the success UI,
  // and a toast sliding in over it would only compete for attention.
  return confirmAndRun({
    title: 'รีเซ็ตรหัสผ่าน',
    message: `ยืนยันการรีเซ็ตรหัสผ่านของ "${fullName}"? ระบบจะสุ่มรหัสผ่านใหม่ให้ และผู้ใช้งานจะต้องตั้งรหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไป`,
    confirmText: 'รีเซ็ตรหัสผ่าน',
    action: () => iamPost(`/users/${userId}/reset-password`),
    errorMessage: 'รีเซ็ตรหัสผ่านไม่สำเร็จ',
    onSuccess: (result) => {
      const username = state.users.find((u) => u.id === userId)?.username ?? '';
      openUserTempPasswordModal(username, result.temp_password, 'รีเซ็ตรหัสผ่านสำเร็จ');
    },
  });
}

export function confirmDeleteUser(userId, fullName) {
  if (!isValidUuid(userId)) {
    showToast(`Invalid user ID: ${userId}`, 'error');
    return;
  }
  return confirmAndRun({
    title: 'ลบผู้ใช้งาน',
    message: `ยืนยันการลบผู้ใช้งาน "${fullName}"?`,
    action: () => iamDelete(`/users/${userId}`),
    successMessage: 'ลบผู้ใช้งานสำเร็จ',
    errorMessage: 'ลบผู้ใช้งานไม่สำเร็จ',
    onSuccess: () => loadUsers(pager.getCurrentPage()),
  });
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
