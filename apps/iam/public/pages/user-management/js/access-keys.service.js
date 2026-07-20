import { showConfirmDialog } from '../../../js/confirm-dialog.service.js';
import { hasPermission } from '../../../js/login.service.js';
import { closeModal, openModal } from '../../../js/modal.service.js';
import { iamDelete, iamGet, iamPost, iamPut } from './api.js';
import { createPaginatedList } from './paginated-list.js';
import { ensurePoliciesLoaded } from './policies.service.js';
import { resetAccessKeyFormDraft, state } from './state.js';
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, formatDateTime, refreshIcons } from './utils.js';

const STATUS_TAG_CLASS = {
  active: 'p-tag-mint',
  inactive: 'p-tag-peach',
  revoked: 'p-tag-pink',
};

// Full, un-paginated user list — cached for the "owner" <select> on the
// access-key form, independent of the users *index page*'s own
// paginated/filtered table (see users.service.js).
async function ensureOwnerUsersLoaded(force = false) {
  if (state.accessKeyOwnerUsersLoaded && !force) return state.accessKeyOwnerUsers;
  const { items } = await iamGet('/users', { ignore_limit: true, sort: 'full_name:asc' });
  state.accessKeyOwnerUsers = items;
  state.accessKeyOwnerUsersLoaded = true;
  return items;
}

// ── Access keys index table — search + status filter + pagination ──────

const query = { search: '', status: '' };
let currentItems = [];

const pager = createPaginatedList({
  defaultPageSize: 20,
  infoId: 'accessKeysPagerInfo',
  prevId: 'accessKeysPrevBtn',
  nextId: 'accessKeysNextBtn',
  fetchPage: async (page, pageSize) => {
    try {
      const or = query.search
        ? [`name||$cont||${query.search}`, `access_key_id||$cont||${query.search}`]
        : undefined;
      const filter = query.status ? [`status||$eq||${query.status}`] : [];

      const [{ items, pagination }] = await Promise.all([
        iamGet('/access-keys', {
          page,
          limit: pageSize,
          sort: 'created_at:desc',
          or,
          filter,
        }),
        ensureOwnerUsersLoaded(),
      ]);

      currentItems = items;
      renderAccessKeysTable();
      return pagination;
    } catch (error) {
      showApiError(error, 'โหลดรายการ Access Key ไม่สำเร็จ');
      return undefined;
    }
  },
});

export function loadAccessKeys(page = 1) {
  return pager.load(page);
}

export function setAccessKeysFilter({ search, status }) {
  if (search !== undefined) query.search = search.trim();
  if (status !== undefined) query.status = status;
  pager.load(1);
}

export function setAccessKeysPageSize(size) {
  pager.setPageSize(size);
}

export function goToAccessKeysPage(direction) {
  return pager.goToPage(direction);
}

function ownerLabel(accessKey) {
  if (accessKey.owner_type !== 'user') return `service_account: ${accessKey.owner_id}`;
  const user = state.accessKeyOwnerUsers.find((u) => u.id === accessKey.owner_id);
  return user ? `${user.full_name} (${user.username})` : accessKey.owner_id;
}

function renderAccessKeysTable() {
  const tbody = document.getElementById('accessKeyTableBody');
  if (!tbody) return;

  if (currentItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="um-empty-cell">ไม่พบ Access Key ที่ตรงกับเงื่อนไข</td></tr>`;
    return;
  }

  const canManage = hasPermission('access_key:update');
  const canRevoke = hasPermission('access_key:revoke');
  const canDelete = hasPermission('access_key:delete');

  tbody.innerHTML = currentItems
    .map((key) => {
      const revoked = key.status === 'revoked';
      return `
    <tr>
      <td>
        <p class="um-cell-title">${escapeHtml(key.name)}</p>
        <p class="um-cell-sub um-mono-input">${escapeHtml(key.access_key_id)}</p>
      </td>
      <td>${escapeHtml(ownerLabel(key))}</td>
      <td><span class="p-tag ${STATUS_TAG_CLASS[key.status] ?? 'p-tag-sky'}">${escapeHtml(key.status)}</span></td>
      <td>${key.expires_at ? formatDateTime(key.expires_at) : '<span class="um-muted-note">ไม่มีวันหมดอายุ</span>'}</td>
      <td>${key.last_used_at ? formatDateTime(key.last_used_at) : '<span class="um-muted-note">ยังไม่เคยใช้งาน</span>'}</td>
      <td class="um-cell-actions">
        ${canManage ? `<a href="${window.__IAM_VIEWS_BASE__}/access-keys/${key.id}/edit" class="p-btn p-btn-ghost p-btn-sm"><i data-lucide="edit-3" class="um-icon-sm"></i> แก้ไข</a>` : ''}
        ${canRevoke && !revoked ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="confirmRevokeAccessKey('${key.id}', '${escapeHtml(key.name).replace(/'/g, "\\'")}')"><i data-lucide="shield-off" class="um-icon-sm"></i> เพิกถอน</button>` : ''}
        ${canDelete ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="confirmDeleteAccessKey('${key.id}', '${escapeHtml(key.name).replace(/'/g, "\\'")}')"><i data-lucide="trash-2" class="um-icon-sm"></i></button>` : ''}
      </td>
    </tr>
  `;
    })
    .join('');
  refreshIcons();
}

// ── Create / edit form page (apps/iam/views/pages/access-keys/form.ejs) ──

export async function initAccessKeyForm() {
  const form = document.getElementById('accessKeyForm');
  if (!form) return;

  resetAccessKeyFormDraft();

  const accessKeyId = document.getElementById('view-access-key-form').dataset.accessKeyId || null;
  form.dataset.editingId = accessKeyId ?? '';

  const isEdit = !!accessKeyId;
  document.getElementById('frmAccessKeyOwnerType').disabled = isEdit;
  document.getElementById('frmAccessKeyOwnerUserId').disabled = isEdit;
  document.getElementById('frmAccessKeyOwnerServiceId').disabled = isEdit;
  document.getElementById('accessKeyStatusField').classList.toggle('hidden', !isEdit);

  try {
    await Promise.all([ensurePoliciesLoaded(), ensureOwnerUsersLoaded()]);
    renderOwnerUserOptions();
    toggleAccessKeyOwnerType();

    if (isEdit) {
      const [accessKey, { policy_ids }] = await Promise.all([
        iamGet(`/access-keys/${accessKeyId}`),
        iamGet(`/access-keys/${accessKeyId}/policies`),
      ]);
      document.getElementById('frmAccessKeyName').value = accessKey.name;
      document.getElementById('frmAccessKeyDescription').value = accessKey.description ?? '';
      document.getElementById('frmAccessKeyOwnerType').value = accessKey.owner_type;
      toggleAccessKeyOwnerType();
      if (accessKey.owner_type === 'user') {
        document.getElementById('frmAccessKeyOwnerUserId').value = accessKey.owner_id;
      } else {
        document.getElementById('frmAccessKeyOwnerServiceId').value = accessKey.owner_id;
      }
      document.getElementById('frmAccessKeyStatus').value = accessKey.status;
      document.getElementById('frmAccessKeyExpiresAt').value = accessKey.expires_at
        ? accessKey.expires_at.slice(0, 16)
        : '';
      state.accessKeyForm.selectedPolicyIds = policy_ids;
    }

    renderAccessKeyPolicyCheckboxes();
  } catch (error) {
    showApiError(error, 'โหลดข้อมูล Access Key ไม่สำเร็จ');
  }
}

/** Toggles which "owner" <select> is visible, based on the currently
 * selected owner type — both list the same users, just tagged with a
 * different owner_type on submit. */
export function toggleAccessKeyOwnerType() {
  const isUser = document.getElementById('frmAccessKeyOwnerType').value === 'user';
  document.getElementById('accessKeyOwnerUserWrap').classList.toggle('hidden', !isUser);
  document.getElementById('accessKeyOwnerServiceWrap').classList.toggle('hidden', isUser);
}

function renderOwnerUserOptions() {
  const options = state.accessKeyOwnerUsers
    .map((user) => `<option value="${user.id}">${escapeHtml(user.full_name)} (${escapeHtml(user.username)})</option>`)
    .join('');
  document.getElementById('frmAccessKeyOwnerUserId').innerHTML = options;
  document.getElementById('frmAccessKeyOwnerServiceId').innerHTML = options;
}

function renderAccessKeyPolicyCheckboxes() {
  const container = document.getElementById('accessKeyPoliciesContainer');
  if (state.policies.length === 0) {
    container.innerHTML = `<p class="um-muted-note">ยังไม่มี Policy ในระบบ — ไปสร้างที่หน้า "นโยบายความปลอดภัย" ก่อน</p>`;
    return;
  }

  container.innerHTML = state.policies
    .map(
      (policy) => `
    <label class="um-checkbox-card">
      <input type="checkbox" name="accessKeyPolicyIds" value="${policy.id}" ${state.accessKeyForm.selectedPolicyIds.includes(policy.id) ? 'checked' : ''}>
      <div>
        <span class="um-checkbox-title">${escapeHtml(policy.name?.th)}</span>
        <span class="um-checkbox-sub">${escapeHtml(policy.code)}</span>
        <span class="p-tag ${policy.is_active ? 'p-tag-mint' : 'p-tag-pink'}">${policy.is_active ? 'Active' : 'Inactive'}</span>
      </div>
    </label>
  `,
    )
    .join('');
  refreshIcons();
}

export async function handleAccessKeyFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const editingId = form.dataset.editingId || null;

  const policyIds = Array.from(
    form.querySelectorAll('input[name="accessKeyPolicyIds"]:checked'),
  ).map((input) => input.value);
  const expiresAtRaw = document.getElementById('frmAccessKeyExpiresAt').value;

  try {
    if (editingId) {
      const payload = {
        name: document.getElementById('frmAccessKeyName').value.trim(),
        description: document.getElementById('frmAccessKeyDescription').value.trim() || null,
        status: document.getElementById('frmAccessKeyStatus').value,
        expires_at: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
      };
      await iamPut(`/access-keys/${editingId}`, payload);
      await iamPut(`/access-keys/${editingId}/policies`, { policy_ids: policyIds });

      showToast('บันทึก Access Key สำเร็จ', 'success');
      window.location.href = `${window.__IAM_VIEWS_BASE__}/access-keys`;
      return;
    }

    const ownerType = document.getElementById('frmAccessKeyOwnerType').value;
    const ownerId =
      ownerType === 'user'
        ? document.getElementById('frmAccessKeyOwnerUserId').value
        : document.getElementById('frmAccessKeyOwnerServiceId').value;

    const payload = {
      name: document.getElementById('frmAccessKeyName').value.trim(),
      description: document.getElementById('frmAccessKeyDescription').value.trim() || null,
      owner_type: ownerType,
      owner_id: ownerId,
      expires_at: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
    };
    const created = await iamPost('/access-keys', payload);
    if (policyIds.length > 0) {
      await iamPut(`/access-keys/${created.id}/policies`, { policy_ids: policyIds });
    }

    // Stay on this page — the secret is only ever returned on this one
    // response, so the reveal modal opens here rather than after navigating
    // back to the list. Closing the modal is what actually returns the user
    // to the list (see closeAccessKeySecretModal).
    openAccessKeySecretModal(created.access_key_id, created.secret_key);
  } catch (error) {
    showApiError(error, 'บันทึก Access Key ไม่สำเร็จ');
  }
}

// ── Secret reveal modal (apps/iam/views/pages/access-keys/form.ejs) —
// shown exactly once, right after creation ──

export function openAccessKeySecretModal(accessKeyId, secretKey) {
  document.getElementById('secretModalAccessKeyId').value = accessKeyId;
  document.getElementById('secretModalSecretKey').value = secretKey;
  openModal(document.getElementById('accessKeySecretModal'));
}

export function closeAccessKeySecretModal() {
  const modal = document.getElementById('accessKeySecretModal');
  closeModal(modal);
  // The secret only ever lives in this modal's inputs for as long as it's
  // open — clear it immediately on close so it doesn't linger in the DOM.
  document.getElementById('secretModalAccessKeyId').value = '';
  document.getElementById('secretModalSecretKey').value = '';
  window.location.href = `${window.__IAM_VIEWS_BASE__}/access-keys`;
}

export async function copyFieldToClipboard(fieldId, label) {
  const field = document.getElementById(fieldId);
  try {
    await navigator.clipboard.writeText(field.value);
    showToast(`คัดลอก${label}แล้ว`, 'success');
  } catch (error) {
    showApiError(error, `คัดลอก${label}ไม่สำเร็จ — กรุณาคัดลอกด้วยตนเอง`);
  }
}

// ── Revoke / delete ──────────────────────────────────────────────────────

export async function confirmRevokeAccessKey(accessKeyId, name) {
  const confirmed = await showConfirmDialog({
    title: 'เพิกถอน Access Key',
    message: `ยืนยันการเพิกถอน Access Key "${name}"? หลังเพิกถอนแล้วจะไม่สามารถใช้งาน key นี้ได้อีก และไม่สามารถย้อนกลับได้`,
    confirmText: 'เพิกถอน',
  });
  if (!confirmed) return;
  try {
    await iamDelete(`/access-keys/${accessKeyId}/revoke`);
    showToast('เพิกถอน Access Key สำเร็จ', 'success');
    loadAccessKeys(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'เพิกถอน Access Key ไม่สำเร็จ');
  }
}

export async function confirmDeleteAccessKey(accessKeyId, name) {
  const confirmed = await showConfirmDialog({
    title: 'ลบ Access Key',
    message: `ยืนยันการลบ Access Key "${name}"?`,
    confirmText: 'ลบ',
  });
  if (!confirmed) return;
  try {
    await iamDelete(`/access-keys/${accessKeyId}`);
    showToast('ลบ Access Key สำเร็จ', 'success');
    loadAccessKeys(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'ลบ Access Key ไม่สำเร็จ');
  }
}
