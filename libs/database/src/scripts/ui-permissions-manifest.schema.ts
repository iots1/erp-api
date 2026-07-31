/**
 * Declarative source of `ui`-plane permissions for a frontend that can't be
 * regex-scanned for `data-permission="..."` attributes the way the EJS admin
 * views can (e.g. a Next.js app, where the same JSX prop compiles away and
 * doesn't exist as a literal string in the shipped source, or where the team
 * simply prefers an explicit manifest over convention-scanning).
 *
 * Convention: a frontend app opts into this by placing a file named exactly
 * `ui-permissions.manifest.json` at its app root — `apps/<service>/ui-permissions.manifest.json`
 * — mirroring how EJS-based apps are scanned from `apps/<service>/views` +
 * `apps/<service>/public`. `sync-permissions.script.ts` picks it up
 * automatically if present; nothing else needs to change when a new frontend
 * app adopts it. `apps/frontend-web` and `apps/iam` both have one.
 *
 * It is worth adopting even for an app the attribute scan *can* read (as
 * `apps/iam` did): a `data-permission` attribute has nowhere to carry a
 * `{ th, en }`, so those rows land in the catalog with a humanized placeholder
 * name, and the attribute says nothing about which page a component sits on.
 * A manifest entry wins over an attribute hit for the same
 * `(service, permission)`, so adding one is purely additive.
 *
 * One page = one sidebar/route-level permission, with its own components
 * (buttons, widgets, sections — anything gated independently of the page
 * itself) nested underneath, so a single file gives a full picture of "this
 * page, and everything on it that can be individually shown/hidden."
 *
 * That nesting is load-bearing, not just documentation: a nested component
 * takes its parent page's derived `resource` (`page:view_dashboard` →
 * `page_dashboard`) instead of the generic `component`, which is what makes
 * the Policy Generator's "หน้าจอ / Component Group (UI)" dropdown list one
 * entry per page holding the page permission and its components together.
 *
 * @example
 * ```json
 * {
 *   "pages": [
 *     {
 *       "permission": "page:view_sessions",
 *       "name": { "th": "หน้าผู้ใช้งานออนไลน์", "en": "Active sessions page" },
 *       "components": [
 *         {
 *           "permission": "component:btn_revoke_session",
 *           "name": { "th": "ปุ่มเพิกถอนการเข้าใช้งาน", "en": "Revoke session button" }
 *         }
 *       ]
 *     }
 *   ]
 * }
 * ```
 */

export interface IUiPermissionName {
  th: string;
  en: string;
}

export interface IUiPermissionManifestComponent {
  /** Full `component:<slug>` string — same permission catalog key convention
   * every other ui-plane row uses. */
  permission: string;
  name: IUiPermissionName;
}

export interface IUiPermissionManifestPage {
  /** Full `page:<slug>` string. */
  permission: string;
  name: IUiPermissionName;
  /** Buttons/widgets/sections on this page that are gated independently of
   * the page-level permission itself. Optional — a page can have none. */
  components?: IUiPermissionManifestComponent[];
}

export interface IUiPermissionsManifest {
  pages: IUiPermissionManifestPage[];
}

export const UI_PERMISSIONS_MANIFEST_FILENAME = 'ui-permissions.manifest.json';
