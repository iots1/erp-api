// Audit-logs page — read-only view over auth-bc's login_histories table
// (GET /auth/login-histories, added specifically for this page — see
// apps/auth/src/modules/auth/controllers/login-histories.controller.ts).
import { authAdminGet } from './auth-admin-api.js';
import { createPaginatedList } from './paginated-list.js';
import { showApiError } from './toast.service.js';
import { escapeHtml, formatDateTime, refreshIcons } from './utils.js';

const query = { username: '', result: '' };

const pager = createPaginatedList({
  defaultPageSize: 15,
  infoId: 'auditLogPagerInfo',
  prevId: 'auditLogPrevBtn',
  nextId: 'auditLogNextBtn',
  fetchPage: async (page, pageSize) => {
    try {
      const filter = [];
      if (query.username) filter.push(`username||$cont||${query.username}`);
      if (query.result === 'success') filter.push('is_success||$eq||true');
      if (query.result === 'failed') filter.push('is_success||$eq||false');

      const { items, pagination } = await authAdminGet('/auth/login-histories', {
        page,
        limit: pageSize,
        sort: 'logged_in_at:desc',
        filter,
      });
      renderTable(items);
      return pagination;
    } catch (error) {
      showApiError(error, 'โหลดบันทึกการเข้าใช้งานไม่สำเร็จ');
      return undefined;
    }
  },
});

export function setLoginHistoriesFilter({ username, result }) {
  if (username !== undefined) query.username = username.trim();
  if (result !== undefined) query.result = result;
  pager.load(1);
}

export function setLoginHistoriesPageSize(size) {
  pager.setPageSize(size);
}

export function loadLoginHistories(page = 1) {
  return pager.load(page);
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

export function goToLoginHistoriesPage(direction) {
  return pager.goToPage(direction);
}
