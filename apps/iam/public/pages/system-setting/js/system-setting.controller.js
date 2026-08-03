import { createAdminPage } from '../../user-management/js/admin-page.js';

// Static placeholder markup — nothing to load, nothing to wire; this page just
// needs the shell booted and its permission checked.
createAdminPage({ pagePermission: 'page:view_settings' });
