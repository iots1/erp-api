// Shared boot/shell logic for every iam-view admin page (dashboard, users,
// roles, policies, audit-logs, sessions, system-setting). Each page is now
// its own server route (see CLAUDE.md-style per-page split), but they all
// share one login gate + sidebar + topbar shell, so that wiring lives here
// once instead of being copy-pasted into every page controller.
import { showChangePasswordModal } from '../../../js/change-password.service.js';
import { getCurrentUser, hasPermission, isAuthenticated, login, logout } from '../../../js/login.service.js';
import { initThemeIcon } from '../../../js/theme.service.js';
import { refreshIcons } from './utils.js';

export async function handleInitialLoginSubmit(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.classList.add('hidden');

  const submitBtn = event.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await login(username, password);
    window.location.reload();
  } catch (error) {
    errorEl.textContent = error.message || 'เข้าสู่ระบบไม่สำเร็จ';
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
}

export async function handleLogout() {
  await logout();
  window.location.reload();
}

function renderCurrentUser() {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById('currentLoginName').textContent = user.fullname ?? user.username;
  document.getElementById('currentLoginRole').textContent = (user.roles ?? []).join(', ') || '-';
}

/** Hides every [data-permission] element the current session lacks, and hides
 * a nav group's label entirely once none of its items are visible. */
export function applyPermissionVisibility() {
  document.querySelectorAll('[data-permission]').forEach((el) => {
    const required = el.getAttribute('data-permission');
    el.classList.toggle('hidden', !hasPermission(required));
  });

  document.querySelectorAll('.um-nav-group-label').forEach((label) => {
    let sibling = label.nextElementSibling;
    let hasVisibleChild = false;
    while (sibling && sibling.classList.contains('um-nav-item')) {
      if (!sibling.classList.contains('hidden')) {
        hasVisibleChild = true;
        break;
      }
      sibling = sibling.nextElementSibling;
    }
    label.classList.toggle('hidden', !hasVisibleChild);
  });

  refreshIcons();
}

function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
}

function showNoAccessMessage() {
  const main = document.querySelector('.um-view.active') ?? document.getElementById('appShell');
  if (!main) return;
  main.innerHTML = `
    <article class="um-table-card">
      <p class="um-muted-note">บัญชีนี้ยังไม่ได้รับสิทธิ์การเข้าถึงเมนูใดๆ กรุณาติดต่อผู้ดูแลระบบให้กำหนดบทบาท (role) ให้กับบัญชีนี้</p>
    </article>
  `;
}

/**
 * Boots a page: shows the login gate or the app shell, wires the shared
 * header/sidebar controls, and — once authenticated — redirects to the
 * dashboard if the session lacks `pagePermission` (the page's own
 * `data-permission`, e.g. `page:view_sessions`) rather than rendering a page
 * the sidebar itself would hide.
 * @param {{ pagePermission?: string, loader?: () => void }} options
 */
export function bootAdminPage({ pagePermission, loader } = {}) {
  refreshIcons();
  initThemeIcon();

  if (!isAuthenticated()) {
    showLogin();
    return;
  }

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  renderCurrentUser();

  // Must-change-password is an authentication-level gate, not an
  // authorization one — it has to be checked (and win) before the
  // pagePermission check below. A freshly-created user has no role yet, so
  // they hold zero permissions (not even page:view_dashboard); checking
  // pagePermission first would redirect them to /dashboard, which redirects
  // right back to itself for the same reason, forever — and the mandatory
  // password-change screen would never get a chance to show. Mirrors
  // AuthGuard's server-side ordering (must_change_password blocks everything
  // before PermissionGuard even runs).
  if (getCurrentUser()?.must_change_password) {
    applyPermissionVisibility();
    refreshIcons();
    showChangePasswordModal();
    return;
  }

  if (pagePermission && !hasPermission(pagePermission)) {
    const dashboardPath = `${window.__IAM_VIEWS_BASE__}/dashboard`;
    if (window.location.pathname === dashboardPath) {
      // Already on the fallback target and still lack access — redirecting
      // again would loop forever (e.g. a user with no role assigned at all).
      // Show an explicit "no access" state instead of bouncing.
      applyPermissionVisibility();
      refreshIcons();
      showNoAccessMessage();
      return;
    }
    window.location.href = dashboardPath;
    return;
  }

  applyPermissionVisibility();
  refreshIcons();
  loader?.();
}
