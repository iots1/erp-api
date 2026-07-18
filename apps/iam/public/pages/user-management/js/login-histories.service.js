// Audit-logs page — read-only view over auth-bc's login_histories table
// (GET /auth/login-histories, added specifically for this page — see
// apps/auth/src/modules/auth/controllers/login-histories.controller.ts).
import { authAdminGet } from './auth-admin-api.js';
import { showApiError } from './toast.service.js';
import { escapeHtml, formatDateTime, refreshIcons } from './utils.js';

const query = { username: '', result: '' };
let currentPage = 1;
let currentPagination = null;

export function setLoginHistoriesFilter({ username, result }) {
  if (username !== undefined) query.username = username.trim();
  if (result !== undefined) query.result = result;
  loadLoginHistories(1);
}

export async function loadLoginHistories(page = 1) {
  currentPage = page;
  try {
    const filter = [];
    if (query.username) filter.push(`username||$cont||${query.username}`);
    if (query.result === 'success') filter.push('is_success||$eq||true');
    if (query.result === 'failed') filter.push('is_success||$eq||false');

    const { items, pagination } = await authAdminGet('/auth/login-histories', {
      page,
      limit: 15,
      sort: 'logged_in_at:desc',
      filter,
    });
    currentPagination = pagination;
    renderTable(items);
    renderPager();
  } catch (error) {
    showApiError(error, 'โหลดบันทึกการเข้าใช้งานไม่สำเร็จ');
  }
}

function renderTable(items) {
  const tbody = document.getElementById('auditLogTableBody');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="um-empty-cell">ไม่พบประวัติการเข้าใช้งาน</td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map(
      (row) => `
    <tr>
      <td>
        <p class="um-cell-title">${escapeHtml(row.username)}</p>
        <p class="um-cell-mono">${escapeHtml(row.user_id ?? '-')}</p>
      </td>
      <td>${escapeHtml(row.ip_address ?? '-')}</td>
      <td class="um-cell-truncate" title="${escapeHtml(row.user_agent ?? '')}">${escapeHtml(row.user_agent ?? '-')}</td>
      <td><span class="status-pill ${row.is_success ? 'status-active' : 'status-suspended'}">${row.is_success ? 'สำเร็จ' : 'ล้มเหลว'}</span></td>
      <td>${escapeHtml(formatDateTime(row.logged_in_at))}</td>
    </tr>
  `,
    )
    .join('');
  refreshIcons();
}

function renderPager() {
  const info = document.getElementById('auditLogPagerInfo');
  const prevBtn = document.getElementById('auditLogPrevBtn');
  const nextBtn = document.getElementById('auditLogNextBtn');
  if (!info || !currentPagination) return;

  info.textContent = `หน้า ${currentPagination.page} / ${currentPagination.total_pages} (ทั้งหมด ${currentPagination.total_records} รายการ)`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= currentPagination.total_pages;
}

export function goToLoginHistoriesPage(direction) {
  const nextPage = currentPage + direction;
  if (nextPage < 1) return;
  if (currentPagination && nextPage > currentPagination.total_pages) return;
  loadLoginHistories(nextPage);
}
