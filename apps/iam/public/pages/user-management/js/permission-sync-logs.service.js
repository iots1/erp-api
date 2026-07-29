// Permission Sync Logs page — read-only history of `permissions:sync` runs
// (permission_sync_logs table). No create/edit/delete — every row is written
// by PermissionsSyncService.runSync() (the "Sync Permissions" button on the
// Permissions page) or the CLI script.
import { iamGet } from './api.js';
import { createPaginatedList } from './paginated-list.js';
import { showApiError } from './toast.service.js';
import { escapeHtml, refreshIcons } from './utils.js';

let currentItems = [];

const pager = createPaginatedList({
  defaultPageSize: 20,
  infoId: 'permissionSyncLogsPagerInfo',
  prevId: 'permissionSyncLogsPrevBtn',
  nextId: 'permissionSyncLogsNextBtn',
  tbodyId: 'permissionSyncLogsTableBody',
  columnCount: 5,
  fetchPage: async (page, pageSize) => {
    try {
      const { items, pagination } = await iamGet('/permission-syncs', {
        page,
        limit: pageSize,
        sort: 'created_at:desc',
      });
      currentItems = items;
      renderTable();
      return pagination;
    } catch (error) {
      showApiError(error, 'โหลดประวัติการ sync ไม่สำเร็จ');
      return undefined;
    }
  },
});

export function loadPermissionSyncLogs(page = 1) {
  return pager.load(page);
}

export function goToPermissionSyncLogsPage(direction) {
  return pager.goToPage(direction);
}

export function setPermissionSyncLogsPageSize(size) {
  pager.setPageSize(size);
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH');
}

function renderEntryList(entries) {
  if (!entries || entries.length === 0) return '<span class="um-muted-note">-</span>';
  return `<ul class="um-cell-list">${entries
    .map(
      (e) =>
        `<li class="um-cell-mono">[${escapeHtml(e.service)}]${e.plane ? ` (${escapeHtml(e.plane)})` : ''} ${escapeHtml(e.permission)}</li>`,
    )
    .join('')}</ul>`;
}

function renderTable() {
  const tbody = document.getElementById('permissionSyncLogsTableBody');
  if (!tbody) return;

  if (currentItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="um-empty-cell">ยังไม่มีประวัติการ sync</td></tr>`;
    return;
  }

  tbody.innerHTML = currentItems
    .map(
      (log) => `
    <tr>
      <td><p class="um-cell-title">${escapeHtml(formatDateTime(log.created_at))}</p></td>
      <td><span class="p-tag p-tag-mint">+${log.added_count}</span>${renderEntryList(log.added)}</td>
      <td><span class="p-tag p-tag-peach">-${log.removed_count}</span>${renderEntryList(log.removed)}</td>
      <td>${log.unchanged_count}</td>
      <td><p class="um-cell-mono">${escapeHtml(log.triggered_by ?? '-')}</p></td>
    </tr>
  `,
    )
    .join('');
  refreshIcons();
}
