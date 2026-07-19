// Permissions page — full list of the permissions catalog (both planes) with
// manual CRUD, gated so a synced row (from permissions:sync) can never be
// deleted and can only have its display name edited — see
// apps/iam/src/modules/permissions/services/permissions.service.ts for the
// backend half of this same rule.
import { hasPermission } from '../../../js/login.service.js';
import { closeModal, openModal } from '../../../js/modal.service.js';
import { iamDelete, iamGet, iamPost, iamPut } from './api.js';
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, refreshIcons } from './utils.js';

const PERMISSION_PATTERN = /^(page|component):[a-zA-Z0-9_]+$/;
const SERVICE_PATTERN = /^[a-z][a-z0-9-]*$/;
const DEFAULT_PAGE_SIZE = 50;

const query = { search: '', service: '', plane: '', source: '' };
let pageSize = DEFAULT_PAGE_SIZE;
let currentPage = 1;
let currentPagination = null;
let currentItems = [];
let serviceOptionsLoaded = false;

export function setPermissionsFilter({ search, service, plane, source }) {
  if (search !== undefined) query.search = search.trim();
  if (service !== undefined) query.service = service;
  if (plane !== undefined) query.plane = plane;
  if (source !== undefined) query.source = source;
  loadPermissions(1);
}

export function setPermissionsPageSize(size) {
  pageSize = Number(size) || DEFAULT_PAGE_SIZE;
  loadPermissions(1);
}

/** Populates the service filter <select> from the distinct services already
 * in the catalog — fetched once (ignore_limit), independent of the paginated
 * table load/filters, so the dropdown always lists every service regardless
 * of the current page/filter. */
export async function ensureServiceFilterOptions() {
  if (serviceOptionsLoaded) return;
  const select = document.getElementById('permServiceFilter');
  if (!select) return;

  try {
    const { items } = await iamGet('/permissions', { ignore_limit: true });
    const services = [...new Set(items.map((p) => p.service))].sort();
    for (const service of services) {
      const option = document.createElement('option');
      option.value = service;
      option.textContent = service;
      select.appendChild(option);
    }
    serviceOptionsLoaded = true;
  } catch (error) {
    showApiError(error, 'โหลดรายชื่อ service ไม่สำเร็จ');
  }
}

export async function loadPermissions(page = 1) {
  currentPage = page;
  try {
    const filter = [];
    if (query.service) filter.push(`service||$eq||${query.service}`);
    if (query.plane) filter.push(`plane||$eq||${query.plane}`);
    if (query.source === 'manual') filter.push('is_manual||$eq||true');
    if (query.source === 'synced') filter.push('is_manual||$eq||false');

    const or = query.search
      ? [
          `service||$cont||${query.search}`,
          `permission||$cont||${query.search}`,
          `permission_name_th||$cont||${query.search}`,
          `permission_name_en||$cont||${query.search}`,
        ]
      : undefined;

    const { items, pagination } = await iamGet('/permissions', {
      page,
      limit: pageSize,
      sort: 'service:asc,permission:asc',
      filter,
      or,
    });
    currentItems = items;
    currentPagination = pagination;
    renderTable();
    renderPager();
  } catch (error) {
    showApiError(error, 'โหลดแคตตาล็อกสิทธิ์ไม่สำเร็จ');
  }
}

function renderTable() {
  const tbody = document.getElementById('permissionsTableBody');
  if (!tbody) return;

  if (currentItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="um-empty-cell">ไม่พบสิทธิ์ที่ตรงกับเงื่อนไข</td></tr>`;
    return;
  }

  const canUpdate = hasPermission('permission:update');
  const canDelete = hasPermission('permission:delete');

  tbody.innerHTML = currentItems
    .map((p) => {
      const planeTag = p.plane === 'ui' ? 'p-tag-sky' : 'p-tag-lavender';
      const sourceTag = p.is_manual ? 'p-tag-mint' : 'p-tag-peach';
      const sourceLabel = p.is_manual ? 'Manual' : 'Synced';
      return `
    <tr>
      <td><span class="p-tag ${planeTag}">${escapeHtml(p.plane)}</span></td>
      <td>
        <p class="um-cell-title">${escapeHtml(p.permission)}</p>
        <p class="um-cell-sub">${escapeHtml(p.service)}</p>
      </td>
      <td>
        <p class="um-cell-title">${escapeHtml(p.permission_name_th)}</p>
        <p class="um-cell-sub">${escapeHtml(p.permission_name_en)}</p>
      </td>
      <td><span class="p-tag ${sourceTag}">${sourceLabel}</span></td>
      <td class="um-cell-actions">
        ${canUpdate ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="openPermissionModal('${p.id}')"><i data-lucide="edit-3" class="um-icon-sm"></i></button>` : ''}
        ${canDelete && p.is_manual ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="confirmDeletePermission('${p.id}', '${escapeHtml(p.permission).replace(/'/g, "\\'")}')"><i data-lucide="trash-2" class="um-icon-sm"></i></button>` : ''}
      </td>
    </tr>
  `;
    })
    .join('');
  refreshIcons();
}

function renderPager() {
  const info = document.getElementById('permissionsPagerInfo');
  const prevBtn = document.getElementById('permissionsPrevBtn');
  const nextBtn = document.getElementById('permissionsNextBtn');
  if (!info || !currentPagination) return;

  info.textContent = `หน้า ${currentPagination.page} / ${currentPagination.total_pages} (ทั้งหมด ${currentPagination.total_records} รายการ)`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= currentPagination.total_pages;
}

export function goToPermissionsPage(direction) {
  const nextPage = currentPage + direction;
  if (nextPage < 1) return;
  if (currentPagination && nextPage > currentPagination.total_pages) return;
  loadPermissions(nextPage);
}

// ── Add / edit modal ────────────────────────────────────────────

export function openPermissionModal(id) {
  const modal = document.getElementById('permissionFormModal');
  const form = document.getElementById('permissionForm');
  form.reset();
  form.dataset.editingId = id ?? '';

  const serviceInput = document.getElementById('frmPermService');
  const permissionInput = document.getElementById('frmPermPermission');
  const identityHint = document.getElementById('permIdentityHint');

  if (id) {
    const existing = currentItems.find((p) => p.id === id);
    if (!existing) return;

    document.getElementById('permissionFormTitle').textContent = 'แก้ไขสิทธิ์';
    serviceInput.value = existing.service;
    permissionInput.value = existing.permission;
    document.getElementById('frmPermNameTh').value =
      existing.permission_name?.th;
    document.getElementById('frmPermNameEn').value =
      existing.permission_name?.en;

    const editableIdentity = existing.is_manual;
    serviceInput.disabled = !editableIdentity;
    permissionInput.disabled = !editableIdentity;
    identityHint.classList.toggle('hidden', editableIdentity);
  } else {
    document.getElementById('permissionFormTitle').textContent =
      'เพิ่มสิทธิ์ด้วยตนเอง';
    serviceInput.disabled = false;
    permissionInput.disabled = false;
    identityHint.classList.add('hidden');
  }

  openModal(modal);
}

export function closePermissionModal() {
  closeModal(document.getElementById('permissionFormModal'));
}

export async function handlePermissionFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const editingId = form.dataset.editingId || null;

  const serviceInput = document.getElementById('frmPermService');
  const permissionInput = document.getElementById('frmPermPermission');
  const nameTh = document.getElementById('frmPermNameTh').value.trim();
  const nameEn = document.getElementById('frmPermNameEn').value.trim();

  const payload = { permission_name_th: nameTh, permission_name_en: nameEn };

  if (!serviceInput.disabled) {
    const service = serviceInput.value.trim();
    if (!SERVICE_PATTERN.test(service)) {
      showToast('Service ต้องเป็นตัวพิมพ์เล็ก เช่น iam, inventory-bc', 'error');
      return;
    }
    payload.service = service;
  }
  if (!permissionInput.disabled) {
    const permission = permissionInput.value.trim();
    if (!PERMISSION_PATTERN.test(permission)) {
      showToast(
        'Permission ต้องขึ้นต้นด้วย page: หรือ component: เท่านั้น',
        'error',
      );
      return;
    }
    payload.permission = permission;
  }

  try {
    if (editingId) {
      await iamPut(`/permissions/${editingId}`, payload);
      showToast('บันทึกสิทธิ์สำเร็จ', 'success');
    } else {
      await iamPost('/permissions', payload);
      showToast('เพิ่มสิทธิ์สำเร็จ', 'success');
    }
    closePermissionModal();
    loadPermissions(currentPagination?.page ?? 1);
  } catch (error) {
    showApiError(error, 'บันทึกสิทธิ์ไม่สำเร็จ');
  }
}

export async function confirmDeletePermission(id, label) {
  if (!window.confirm(`ยืนยันการลบสิทธิ์ "${label}"?`)) return;
  try {
    await iamDelete(`/permissions/${id}`);
    showToast('ลบสิทธิ์สำเร็จ', 'success');
    loadPermissions(currentPagination?.page ?? 1);
  } catch (error) {
    showApiError(error, 'ลบสิทธิ์ไม่สำเร็จ');
  }
}
