// Shared boot/shell logic for every iam-view admin page (dashboard, users,
// roles, policies, audit-logs, sessions, system-setting). Each page is now
// its own server route (see CLAUDE.md-style per-page split), but they all
// share one login gate + sidebar + topbar shell, so that wiring lives here
// once instead of being copy-pasted into every page controller.
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

  if (pagePermission && !hasPermission(pagePermission)) {
    window.location.href = `${window.__IAM_VIEWS_BASE__}/dashboard`;
    return;
  }

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  renderCurrentUser();
  applyPermissionVisibility();
  loader?.();
  refreshIcons();
}
