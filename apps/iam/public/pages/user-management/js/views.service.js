// Sub-view switching *within* a single page — used only by the roles page
// (list <-> role-form) and the policies page (list <-> policy-form). Navigating
// between sidebar sections (dashboard/users/roles/...) is real <a href>
// navigation between server routes now (see shell.service.js bootAdminPage).
export function switchView(viewId) {
  document.querySelectorAll('.um-view').forEach((section) => section.classList.remove('active'));
  document.getElementById(`view-${viewId}`)?.classList.add('active');
}
