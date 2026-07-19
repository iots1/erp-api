// Active-sessions page — lists live Redis `session:<jti>` keys and lets an
// admin force-logout one (GET/DELETE /auth/sessions, see
// apps/auth/src/modules/auth/controllers/sessions.controller.ts).
import { hasPermission } from '../../../js/login.service.js';
import { authAdminDelete, authAdminGet } from './auth-admin-api.js';
import { createPaginatedList } from './paginated-list.js';
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, refreshIcons } from './utils.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatTtl(ttlSeconds) {
  const minutes = Math.floor(ttlSeconds / 60);
  const seconds = ttlSeconds % 60;
  return `${minutes} นาที ${seconds} วินาที`;
}

const pager = createPaginatedList({
  defaultPageSize: 15,
  infoId: 'sessionsPagerInfo',
  prevId: 'sessionsPrevBtn',
  nextId: 'sessionsNextBtn',
  fetchPage: async (page, pageSize) => {
    try {
      const { items, pagination } = await authAdminGet('/auth/sessions', {
        page,
        limit: pageSize,
      });
      renderTable(items);
      return pagination;
    } catch (error) {
      showApiError(error, 'โหลดรายชื่อผู้ใช้งานออนไลน์ไม่สำเร็จ');
      return undefined;
    }
  },
});

export function loadSessions(page = 1) {
  return pager.load(page);
}

export function setSessionsPageSize(size) {
  pager.setPageSize(size);
}

// ── Search by user_id — Redis only indexes sessions per-user (no free-text
// match across the whole keyspace), so this hits the dedicated
// `/auth/sessions/users/:user_id` lookup (user_sessions:<user_id> index)
// instead of paginating/filtering findActive's full scan. ──────────────

function setPagerSearchState(infoText, disableNav) {
  const info = document.getElementById('sessionsPagerInfo');
  const prevBtn = document.getElementById('sessionsPrevBtn');
  const nextBtn = document.getElementById('sessionsNextBtn');
  if (info) info.textContent = infoText;
  if (prevBtn) prevBtn.disabled = disableNav;
  if (nextBtn) nextBtn.disabled = disableNav;
}

export async function setSessionsUserIdFilter(value) {
  const userId = value.trim();
  if (!userId) {
    loadSessions(1);
    return;
  }
  if (!UUID_REGEX.test(userId)) {
    renderTable([]);
    setPagerSearchState('รูปแบบ user_id ไม่ถูกต้อง (ต้องเป็น UUID)', true);
    return;
  }

  try {
    const result = await authAdminGet(`/auth/sessions/users/${userId}`);
    const items = result.sessions.map((s) => ({
      jti: s.jti,
      user_id: result.user_id,
      username: null,
      ttl_seconds: s.ttl_seconds,
    }));
    renderTable(items);
    setPagerSearchState(`พบ ${items.length} เซสชันสำหรับผู้ใช้งานนี้`, true);
  } catch (error) {
    showApiError(error, 'ค้นหาเซสชันของผู้ใช้งานไม่สำเร็จ');
  }
}

function renderTable(items) {
  const tbody = document.getElementById('sessionsTableBody');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="um-empty-cell">ไม่มีผู้ใช้งานออนไลน์ในขณะนี้</td></tr>`;
    return;
  }

  const canRevoke = hasPermission('session:revoke');
  tbody.innerHTML = items
    .map(
      (session) => `
    <tr>
      <td>
        <p class="um-cell-title">${escapeHtml(session.username ?? '-')}</p>
        <p class="um-cell-mono">${escapeHtml(session.user_id)}</p>
      </td>
      <td class="um-cell-mono" title="${escapeHtml(session.jti)}">${escapeHtml(session.jti.slice(0, 8))}…</td>
      <td>${formatTtl(session.ttl_seconds)}</td>
      <td class="um-cell-actions">
        ${
          canRevoke
            ? `<button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="revokeSession('${session.jti}', '${escapeHtml(session.username ?? session.user_id).replace(/'/g, "\\'")}')">
                <i data-lucide="log-out" class="um-icon-sm"></i> Revoke
              </button>`
            : ''
        }
      </td>
    </tr>
  `,
    )
    .join('');
  refreshIcons();
}

export function goToSessionsPage(direction) {
  return pager.goToPage(direction);
}

export async function revokeSession(jti, label) {
  if (!window.confirm(`ยืนยันการเพิกถอนการเข้าใช้งานของ "${label}"?`)) return;
  try {
    await authAdminDelete(`/auth/sessions/${jti}`);
    showToast('เพิกถอนการเข้าใช้งานสำเร็จ', 'success');
    loadSessions(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'เพิกถอนการเข้าใช้งานไม่สำเร็จ');
  }
}
