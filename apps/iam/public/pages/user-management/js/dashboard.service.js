import { iamGet } from './api.js';
import { showApiError } from './toast.service.js';
import { applyPermissionVisibility } from './views.service.js';
import { refreshIcons } from './utils.js';

async function countOf(path, extraFilter) {
  const { pagination } = await iamGet(path, {
    limit: 1,
    filter: extraFilter ? [extraFilter] : undefined,
  });
  return pagination?.total_records ?? pagination?.total ?? 0;
}

export async function loadDashboard() {
  const grid = document.getElementById('dashboardStats');
  if (!grid) return;

  try {
    const [totalUsers, totalRoles, activePolicies] = await Promise.all([
      countOf('/users'),
      countOf('/roles'),
      countOf('/policies', 'is_active||$eq||true'),
    ]);

    const stats = [
      {
        permission: 'component:widget_total_users',
        title: 'บุคลากรทั้งหมด',
        value: totalUsers,
        icon: 'users-round',
        color: 'sky',
      },
      {
        permission: 'component:widget_total_roles',
        title: 'Roles ในระบบ',
        value: totalRoles,
        icon: 'shield-check',
        color: 'lavender',
      },
      {
        permission: 'component:widget_active_policies',
        title: 'Policies เปิดใช้งาน',
        value: activePolicies,
        icon: 'key',
        color: 'mint',
      },
    ];

    grid.innerHTML = stats
      .map(
        (s) => `
      <div data-permission="${s.permission}" class="p-card um-stat-card">
        <div class="p-card-head-icon um-stat-icon um-stat-icon-${s.color}"><i data-lucide="${s.icon}"></i></div>
        <p class="um-stat-title">${s.title}</p>
        <h3 class="um-stat-value">${s.value}</h3>
      </div>
    `,
      )
      .join('');
    refreshIcons();
    applyPermissionVisibility();
  } catch (error) {
    showApiError(error, 'โหลดข้อมูลแดชบอร์ดไม่สำเร็จ');
  }
}
