import { getCurrentUser, isAuthenticated, login, logout } from '../../../js/login.service.js';
import { loadDashboard } from './dashboard.service.js';
import { loadPolicies } from './policies.service.js';
import { loadRoles } from './roles.service.js';
import { setUsersFilter, loadUsers } from './users.service.js';
import { debounce, refreshIcons } from './utils.js';
import { applyPermissionVisibility, registerViewLoader, switchView } from './views.service.js';

registerViewLoader('dashboard', loadDashboard);
registerViewLoader('users', () => loadUsers(1));
registerViewLoader('roles', loadRoles);
registerViewLoader('policies', loadPolicies);

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
    showApp();
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

function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  renderCurrentUser();
  applyPermissionVisibility();
  switchView('dashboard', document.querySelector('.um-nav-item[data-view="dashboard"]'));
  refreshIcons();
}

function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
}

function wireFilters() {
  const searchInput = document.getElementById('globalSearch');
  searchInput?.addEventListener(
    'input',
    debounce((e) => setUsersFilter({ search: e.target.value }), 350),
  );

  const deptInput = document.getElementById('filterDept');
  deptInput?.addEventListener(
    'input',
    debounce((e) => setUsersFilter({ department: e.target.value }), 350),
  );
}

function boot() {
  refreshIcons();
  wireFilters();
  if (isAuthenticated()) {
    showApp();
  } else {
    showLogin();
  }
}

boot();
