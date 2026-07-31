// The real permissions catalog (iam.permissions) drives the Policy Generator's
// dropdowns/checkboxes — replaces the mockup's hardcoded stmtOptions /
// apiActionDictionary / uiActionDictionary with live data.
import { iamGet } from './api.js';
import { state } from './state.js';

/**
 * A ui-plane group key. `resource` alone (`page_dashboard`) is not unique —
 * two services can legitimately declare the same page (permissions are unique
 * per (service, permission), not per permission, see CLAUDE.md) — so every ui
 * group is keyed by service too, the same `${service}::${x}` shape the sync
 * scanner already uses for its own dedup map. Without this, two unrelated
 * pages that happen to share a permission string (`iam`'s admin dashboard,
 * `frontend-web`'s customer dashboard) would silently merge into one
 * dropdown entry and one checkbox group.
 */
const uiGroupKey = (row) => `${row.service}::${row.resource}`;
export const splitUiGroupKey = (key) => {
  const [service, resource] = key.split('::');
  return { service, resource };
};

export async function ensurePermissionsCatalog() {
  if (state.permissionsCatalog) return state.permissionsCatalog;
  const { items } = await iamGet('/permissions', { ignore_limit: true });
  state.permissionsCatalog = items;
  return items;
}

function catalogByPlane(plane) {
  return (state.permissionsCatalog ?? []).filter((p) => p.plane === plane);
}

/** Dropdown 1 options: API -> distinct services; UI -> distinct resources (pages/components groups). */
export function getDropdown1Options(plane) {
  const rows = catalogByPlane(plane);

  if (plane === 'api') {
    const services = new Map();
    for (const row of rows) {
      if (!services.has(row.service)) {
        services.set(row.service, { id: row.service, label: row.service });
      }
    }
    return [...services.values()];
  }

  // A ui group is one page (`page_<slug>`) in one service, holding that page's
  // own permission plus every component declared on it — so the group is
  // named after its `page:*` member, tagged with its owning service, never
  // merged across services (see `uiGroupKey`). The leftover `component` group
  // (per service — components with no declared page) has no page member and
  // keeps its resource as the label.
  const groups = new Map();
  for (const row of rows) {
    const key = uiGroupKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, members]) => {
    const { service, resource } = splitUiGroupKey(key);
    const page = members.find((m) => m.permission?.startsWith('page:'));
    const label = page ? (page.permission_name?.th ?? page.permission) : resource;
    return { id: key, label: `[${service}] ${label}` };
  });
}

/** Dropdown 2 (API only): resources within the selected service(s). */
export function getDropdown2Options(selectedServices) {
  const rows = catalogByPlane('api').filter((p) =>
    selectedServices.includes(p.service),
  );
  const seen = new Map();
  for (const row of rows) {
    if (!seen.has(row.resource)) {
      seen.set(row.resource, { id: row.resource, label: row.resource });
    }
  }
  return [...seen.values()];
}

/** Permission rows matching the current Step 2 selection, grouped by resource for the checkbox list. */
export function getMatchingPermissions(plane, selection) {
  if (plane === 'api') {
    const { services, resources } = selection;
    return catalogByPlane('api').filter(
      (p) => services.includes(p.service) && resources.includes(p.resource),
    );
  }
  return catalogByPlane('ui').filter((p) =>
    selection.resources.includes(uiGroupKey(p)),
  );
}

/** Groups an already-matched permission list for the Step 2 checkbox list.
 * ui groups are keyed the same `${service}::${resource}` way as the dropdown
 * (see `uiGroupKey`) so a shared page string across two services still gets
 * two separate checkbox groups. api groups stay keyed by bare `resource` —
 * dd1 there is already the service selector, so mixing services under one
 * resource heading (e.g. two BCs both exposing a `role` resource) is the
 * existing, intended behavior. */
export function groupPermissionsByResource(permissions, plane) {
  const groups = new Map();
  for (const permission of permissions) {
    const key = plane === 'ui' ? uiGroupKey(permission) : permission.resource;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(permission);
  }
  return groups;
}

export function findPermissionById(id) {
  return (state.permissionsCatalog ?? []).find((p) => p.id === id);
}

/**
 * Used when re-opening an existing policy for edit: getStatements() returns
 * permission *strings* with no service attached, but the same string can be
 * declared by more than one service with a different meaning (permissions are
 * only unique per (service, permission), see CLAUDE.md). Narrowing by the
 * statement's own target services resolves the common case; a global,
 * plane-only fallback is the best available for a '*' service target.
 */
export function findPermissionByStringInPlane(permissionString, plane, services = []) {
  const candidates = catalogByPlane(plane).filter((p) => p.permission === permissionString);
  if (candidates.length <= 1) return candidates[0];
  return (
    candidates.find((p) => services.includes(p.service)) ?? candidates[0]
  );
}
