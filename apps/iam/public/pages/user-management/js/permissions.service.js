// The real permissions catalog (iam.permissions) drives the Policy Generator's
// dropdowns/checkboxes — replaces the mockup's hardcoded stmtOptions /
// apiActionDictionary / uiActionDictionary with live data.
import { iamGet } from './api.js';
import { state } from './state.js';

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
  const seen = new Map();
  for (const row of rows) {
    const key = plane === 'api' ? row.service : row.resource;
    if (!seen.has(key)) {
      seen.set(key, {
        id: key,
        label: plane === 'api' ? key : (row.permission_name?.th ?? key),
      });
    }
  }
  return [...seen.values()];
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
  return catalogByPlane('ui').filter((p) => selection.resources.includes(p.resource));
}

export function groupPermissionsByResource(permissions) {
  const groups = new Map();
  for (const permission of permissions) {
    if (!groups.has(permission.resource)) groups.set(permission.resource, []);
    groups.get(permission.resource).push(permission);
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
