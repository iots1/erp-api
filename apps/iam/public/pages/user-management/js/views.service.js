import { hasPermission } from '../../../js/login.service.js';
import { state } from './state.js';
import { refreshIcons } from './utils.js';

const VIEW_TITLES = {
  dashboard: 'แดชบอร์ด',
  users: 'จัดการผู้ใช้งาน',
  roles: 'สิทธิ์การใช้งาน (Roles)',
  'role-form': 'สร้าง/แก้ไขบทบาท',
  policies: 'นโยบายความปลอดภัย',
  'policy-form': 'สร้าง/แก้ไข Policy',
  audit: 'บันทึกการใช้งาน',
  settings: 'ตั้งค่าระบบ',
};

// Views switch by toggling classes only — no data (re)load here. Each view
// that needs fresh data registers a loader below and boot()/switchView()
// invokes it, keeping the "what to fetch" decision out of the DOM-toggling code.
const viewLoaders = new Map();
export function registerViewLoader(viewId, loader) {
  viewLoaders.set(viewId, loader);
}

export function switchView(viewId, navElement) {
  document
    .querySelectorAll('.um-nav-item')
    .forEach((item) => item.classList.remove('active'));
  if (navElement && !navElement.classList.contains('hidden')) {
    navElement.classList.add('active');
  }

  document
    .querySelectorAll('.um-view')
    .forEach((section) => section.classList.remove('active'));
  document.getElementById(`view-${viewId}`)?.classList.add('active');

  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.textContent = VIEW_TITLES[viewId] ?? viewId;

  state.currentView = viewId;
  viewLoaders.get(viewId)?.();
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

  // If the active view/nav item just got hidden (e.g. after a permission
  // change), fall back to the first still-visible page.
  const activeSection = document.querySelector('.um-view.active');
  const activeIsHidden =
    activeSection && !document.querySelector(`.um-nav-item[data-view="${state.currentView}"]:not(.hidden)`);
  if (activeIsHidden) {
    const firstVisible = document.querySelector('.um-nav-item[data-view]:not(.hidden)');
    if (firstVisible) {
      switchView(firstVisible.dataset.view, firstVisible);
    }
  }

  refreshIcons();
}
