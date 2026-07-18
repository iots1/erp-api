// Active-sessions page — lists live Redis `session:<jti>` keys and lets an
// admin force-logout one (GET/DELETE /auth/sessions, see
// apps/auth/src/modules/auth/controllers/sessions.controller.ts).
import { authAdminDelete, authAdminGet } from './auth-admin-api.js';
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, refreshIcons } from './utils.js';

let currentPage = 1;
let currentPagination = null;

function formatTtl(ttlSeconds) {
  const minutes = Math.floor(ttlSeconds / 60);
  const seconds = ttlSeconds % 60;
  return `${minutes} นาที ${seconds} วินาที`;
}

export async function loadSessions(page = 1) {
  currentPage = page;
  try {
    const { items, pagination } = await authAdminGet('/auth/sessions', {
      page,
      limit: 15,
    });
    currentPagination = pagination;
    renderTable(items);
    renderPager();
  } catch (error) {
    showApiError(error, 'โหลดรายชื่อผู้ใช้งานออนไลน์ไม่สำเร็จ');
  }
}

function renderTable(items) {
  const tbody = document.getElementById('sessionsTableBody');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="um-empty-cell">ไม่มีผู้ใช้งานออนไลน์ในขณะนี้</td></tr>`;
    return;
  }

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
        <button type="button" class="p-btn p-btn-ghost p-btn-sm" onclick="revokeSession('${session.jti}', '${escapeHtml(session.username ?? session.user_id).replace(/'/g, "\\'")}')">
          <i data-lucide="log-out" class="um-icon-sm"></i> Revoke
        </button>
      </td>
    </tr>
  `,
    )
    .join('');
  refreshIcons();
}

function renderPager() {
  const info = document.getElementById('sessionsPagerInfo');
  const prevBtn = document.getElementById('sessionsPrevBtn');
  const nextBtn = document.getElementById('sessionsNextBtn');
  if (!info || !currentPagination) return;

  info.textContent = `หน้า ${currentPagination.page} / ${currentPagination.total_pages} (ทั้งหมด ${currentPagination.total_records} เซสชัน)`;
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= currentPagination.total_pages;
}

export function goToSessionsPage(direction) {
  const nextPage = currentPage + direction;
  if (nextPage < 1) return;
  if (currentPagination && nextPage > currentPagination.total_pages) return;
  loadSessions(nextPage);
}

export async function revokeSession(jti, label) {
  if (!window.confirm(`ยืนยันการเพิกถอนการเข้าใช้งานของ "${label}"?`)) return;
  try {
    await authAdminDelete(`/auth/sessions/${jti}`);
    showToast('เพิกถอนการเข้าใช้งานสำเร็จ', 'success');
    loadSessions(currentPage);
  } catch (error) {
    showApiError(error, 'เพิกถอนการเข้าใช้งานไม่สำเร็จ');
  }
}
