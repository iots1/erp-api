import { createAdminPage } from '../../user-management/js/admin-page.js';
import { loadDashboard } from '../../user-management/js/dashboard.service.js';

// Stat cards only — no table, so no filters/pageSize/sort.
createAdminPage({ pagePermission: 'page:view_dashboard', load: loadDashboard });
