---
name: init-view
description: Scaffold a new server-rendered EJS admin page in apps/iam (or a new BC's admin UI copying the same pattern), following the admin-shell convention — list page + optional separate form.ejs, NestJS view controller, esbuild-bundled JS/CSS. Use when asked to "add new page", "create new view", "init view", "scaffold page", or "add admin page to iam/<bc>".
---

# Init View

Scaffolds a **complete, production-ready** EJS admin page inside `apps/iam/views` (or another
BC's admin UI copying the same `apps/iam` pattern — see CLAUDE.md's "EJS admin views"
section, which this skill implements). After running this skill, the new page is accessible at
`/<prefix>/views/{page-name}` and shows up in the sidebar behind its own `page:view_{page_name}`
permission.

`apps/iam/views` is the reference implementation — `views/pages/permissions/index.ejs` is the
canonical **list-only** page, `views/pages/roles/{index,form}.ejs` +
`views/pages/access-keys/{index,form}.ejs` are the canonical **list + separate create/edit
page** pattern. Read those before scaffolding a new one; this skill describes the same shape.

## Two Page Shapes — pick one before scaffolding

| Shape | When to use | Files |
| --- | --- | --- |
| **List-only** | The resource has no create/edit form (dashboard, sessions, audit-logs, system-setting), or editing happens entirely inline in the table row. | `views/pages/{page}/index.ejs` only |
| **List + form page** (default for anything with a create/edit form) | Any resource with more than a couple of fields, or that attaches a checkbox grid (policies, roles). **This is the default** — don't reach for a modal first. | `views/pages/{page}/index.ejs` (list) + `views/pages/{page}/form.ejs` (create/edit, both cases in one file) |
| **List + modal** (exception, not the default) | The form is genuinely small (a handful of fields, no nested attach-grid — see `users/`), or the dialog isn't a navigable resource view at all (the Access Key "reveal secret once" dialog — it exists because that API response can never be re-fetched, not because the create form is a modal). | `views/pages/{page}/index.ejs` with an inline `<dialog>` |

If in doubt, use **list + form page** — it's the pattern every new resource (`roles`,
`policies`, `access-keys`) has converged on, and it's what CLAUDE.md documents as the default.

## Project Structure Convention

Every page lives in three places — **views/** for server-rendered EJS, **public/** for source
JS/CSS (bundled by esbuild), **src/modules/views/** for the NestJS route handler:

```
apps/iam/
├── views/
│   ├── pages/{page-name}/
│   │   ├── index.ejs                           ← List view (table + filters + pager)
│   │   └── form.ejs                            ← Create/edit view (list+form shape only)
│   └── components/
│       ├── admin-shell/                         ← shell-open/shell-close, sidebar, topbar (shared, don't touch per-page)
│       └── ui/                                  ← field, form-header, pager, modal-head, confirm-dialog, toolbar-action-button (shared, reuse — don't hand-roll)
│
├── public/
│   ├── pages/{page-name}/
│   │   ├── js/
│   │   │   ├── entry.js                        ← `import './{page-name}.controller.js'`
│   │   │   └── {page-name}.controller.js        ← Page-local wiring: window bridge, filter listeners, bootAdminPage() call
│   │   └── (no page-specific css/ dir — every admin-shell page shares one stylesheet, see below)
│   ├── pages/user-management/js/                ← **Shared service-logic library** (legacy dir name — every
│   │   │                                            admin-shell page's business logic lives here, not just "users")
│   │   ├── api.js                               ← iamGet/iamPost/iamPut/iamDelete (JSON:API envelope client)
│   │   ├── state.js                             ← Single shared state object + cached lists + form drafts
│   │   ├── paginated-list.js                    ← createPaginatedList({fetchPage,...}) — page/pageSize/pager DOM sync
│   │   ├── load-list.js                         ← loadList(ensureLoaded, render, errorMessage) — cached-full-list reload shape
│   │   ├── toast.service.js                     ← showToast / showApiError
│   │   ├── shell.service.js                     ← bootAdminPage({pagePermission, loader}), login/logout wiring
│   │   ├── {resource}.service.js                ← **New file per resource** — list pager + form logic goes here
│   │   └── ...service.js                        ← roles/policies/users/permissions/access-keys — one per resource
│   └── css/                                     ← theme.css, layout.css, button.css, form.css, table.css, modal.css (shared, global)
│
├── build-assets.mjs                             ← esbuild bundler — register new page in PAGES array
└── src/modules/views/
    ├── controllers/{page-name}.controller.ts    ← NestJS route handler(s)
    └── views.module.ts                          ← Register controller here
```

### Build Pipeline (esbuild IIFE bundling)

`apps/iam/build-assets.mjs` bundles `public/` into `dist/public/`, served at
`/<prefix>/assets/` (see `main.ts`'s `publicDir`). Every admin-shell page uses the
`adminShellPage(name)` helper — it wires the page's own `js/entry.js` → `js/bundle.js` **and**
the one shared `pages/user-management/css/user-management.css` → the page's own
`css/bundle.css` (the shared stylesheet is bundled once per page so each page's `<link>` tag
stays uniform, not because the CSS differs):

```javascript
// build-assets.mjs — add the new page here
const PAGES = [
  adminShellPage('dashboard'),
  adminShellPage('users'),
  adminShellPage('roles'),
  adminShellPage('policies'),
  adminShellPage('permissions'),
  adminShellPage('access-keys'),
  adminShellPage('{page-name}'),   // ← add here
  adminShellPage('audit-logs'),
  adminShellPage('sessions'),
  adminShellPage('system-setting'),
];
```

| Build mode | Behavior | Triggered by |
| --- | --- | --- |
| Local (dev, watch) | Bundle + sourcemaps, no minify | `npm run start:dev:iam` (runs `build:assets:iam:watch` alongside `nest start --watch`) |
| Dev/Staging/Prod | Bundle + minify | `npm run build:assets:iam` (also runs automatically as part of `build:iam`) |

Run `node apps/iam/build-assets.mjs` by hand after scaffolding to confirm the new page bundles
without error before booting the app.

### Window Bridge Pattern

Every page's `{page-name}.controller.js` is the **single** file that assigns page-local
`onclick`/`onsubmit` handlers to `window` (esbuild's `format: 'iife'` means everything else
stays module-scoped and invisible to inline HTML attributes):

```javascript
// public/pages/{page-name}/js/{page-name}.controller.js
import { handleAuthLogin } from '../../../js/auth-guard.service.js';
import { toggleTheme } from '../../../js/theme.service.js';
import {
  confirmDelete{Resource},
  goTo{Resources}Page,
  load{Resources},
  set{Resources}Filter,
  set{Resources}PageSize,
} from '../../user-management/js/{resource}.service.js';
import { bootAdminPage, handleInitialLoginSubmit, handleLogout } from '../../user-management/js/shell.service.js';
import { debounce } from '../../user-management/js/utils.js';

Object.assign(window, {
  handleAuthLogin, handleInitialLoginSubmit, handleLogout, toggleTheme,
  confirmDelete{Resource}, goTo{Resources}Page,
});

function wireFilters() {
  document.getElementById('{resource}SearchFilter')?.addEventListener(
    'input',
    debounce((e) => set{Resources}Filter({ search: e.target.value }), 350),
  );
}

wireFilters();
bootAdminPage({ pagePermission: 'page:view_{page_name}', loader: () => load{Resources}(1) });
```

**For the list+form shape**, one bundle serves *both* `index.ejs` and `form.ejs` — branch on
which page's markup is present rather than splitting into two bundles (see
`roles.controller.js` / `access-keys.controller.js`):

```javascript
const isFormPage = !!document.getElementById('{resource}Form');
if (isFormPage) {
  bootAdminPage({ pagePermission: 'page:view_{page_name}', loader: () => init{Resource}Form() });
} else {
  wireFilters();
  bootAdminPage({ pagePermission: 'page:view_{page_name}', loader: () => load{Resources}(1) });
}
```

---

## Naming Conventions

| Item | Convention | Example (`access-keys`) |
| --- | --- | --- |
| Directory & files | `kebab-case` | `access-keys/`, `access-keys.controller.ts` |
| View controller class | `PascalCase` + `ViewController` | `AccessKeysViewController` |
| View controller route | `'views/{page-name}'` | `'views/access-keys'` |
| Render path (list) | `'pages/{page-name}/index'` | `'pages/access-keys/index'` |
| Render path (form) | `'pages/{page-name}/form'` | `'pages/access-keys/form'` |
| Resource service file | `{resource}.service.js` (singular) | `access-keys.service.js` |
| Page-level `data-*` id on form's root `<section>` | `data-{resource}-id` | `data-access-key-id` |
| UI permission (page gate) | `page:view_{page_name}` (snake_case action) | `page:view_access_keys` |
| CSS class prefix | `um-` (shared admin-shell prefix — pages don't get their own prefix; there's one shared stylesheet, not page-specific CSS) | `.um-table-card`, `.um-form-grid` |

**Permission strings must be `[a-zA-Z0-9_]+:[a-zA-Z0-9_]+` — no hyphens.** `libs/database/src/scripts/sync-permissions.script.ts`
regex-scans `@RequirePermission('resource:action')` and `data-permission="page:action"` and its
pattern doesn't match a hyphenated resource/action — a permission like `'access-key:create'`
silently scans as zero rows. Use `access_key:create`, not `access-key:create` (the *route*
`/access-keys` can still be kebab-case; only the permission string is constrained).

---

## How to Execute

> **Input required from user**: page name (kebab-case), page title (Thai), which shape
> (list-only / list+form / list+modal), and which fields the resource needs.

### Step 1 — Create the view files

#### 1a. `views/pages/{page-name}/index.ejs`

```html
<%- include('../../components/layout/page-head', { pageName: '{page-name}' }) %>
<%
const topbarActions = [
    { btnClass: 'p-btn p-btn-sky p-btn-sm', icon: 'plus', label: 'สร้าง {Resource}', onClick: `location.href='/${prefix}/views/{page-name}/new'`, permission: '{resource}:create' },
];
%>
<%- include('../../components/admin-shell/shell-open', { activeView: '{page-name}', pageTitle: '{Page Title}', topbarActions: topbarActions }) %>

                <section id="view-{page-name}" class="um-view active">
                    <article class="um-table-card">
                        <div class="um-table-toolbar">
                            <input type="text" id="{resource}SearchFilter" class="um-filter-input" placeholder="ค้นหา...">
                        </div>
                        <div class="um-table-scroll-area">
                            <table class="p-table">
                                <thead>
                                    <tr>
                                        <th>{Column}</th>
                                        <th class="um-th-right">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody id="{resource}TableBody"></tbody>
                            </table>
                        </div>
                        <%- include('../../components/ui/pager', {
                            infoId: '{resources}PagerInfo', prevId: '{resources}PrevBtn', nextId: '{resources}NextBtn',
                            onPrev: 'goTo{Resources}Page(-1)', onNext: 'goTo{Resources}Page(1)',
                            pageSizeId: '{resource}PageSize', pageSizeOptions: [20, 50, 100],
                        }) %>
                    </article>
                </section>

<%- include('../../components/admin-shell/shell-close') %>
<%- include('../../components/layout/page-foot', { pageName: '{page-name}' }) %>
```

`onClick` for the create button navigates to `/{page-name}/new` (list+form shape) or calls an
`openXFormModal()` (list+modal shape) — **never inline the toolbar button markup**, always go
through `topbarActions` passed to `shell-open` (which renders via
`components/ui/toolbar-action-button.ejs` internally).

#### 1b. `views/pages/{page-name}/form.ejs` — list+form shape only

```html
<%- include('../../components/layout/page-head', { pageName: '{page-name}' }) %>
<%
const isEdit = !!{resource}Id;
const parentCrumb = { label: '{Page Title}', href: `/${prefix}/views/{page-name}` };
const topbarActions = [
    { btnClass: 'p-btn p-btn-sky p-btn-sm', icon: 'save', label: 'บันทึก', onClick: "document.getElementById('{resource}Form').requestSubmit()" },
];
%>
<%- include('../../components/admin-shell/shell-open', { activeView: '{page-name}', pageTitle: isEdit ? 'แก้ไข {Resource}' : 'สร้าง {Resource} ใหม่', parentCrumb: parentCrumb, topbarActions: topbarActions }) %>

                <section id="view-{resource}-form" class="um-view active" data-{resource}-id="<%= {resource}Id ?? '' %>">
                    <%- include('../../components/ui/form-header', {
                        backHref: `/${prefix}/views/{page-name}`,
                        titleId: '{resource}FormTitle',
                        titleText: isEdit ? 'แก้ไข {Resource}' : 'สร้าง {Resource} ใหม่',
                        subtitleText: '{short description}',
                    }) %>

                    <form id="{resource}Form" onsubmit="handle{Resource}FormSubmit(event)">
                        <article class="um-form-section">
                            <div class="um-form-grid">
                                <%- include('../../components/ui/field', { id: 'frm{Field}', label: '{label}', required: true }) %>
                            </div>
                        </article>
                    </form>
                </section>

<%- include('../../components/admin-shell/shell-close') %>
<%- include('../../components/layout/page-foot', { pageName: '{page-name}' }) %>
```

**Rules:**
- The root `<section>` carries `data-{resource}-id` — the JS controller's `init{Resource}Form()`
  reads it via `document.getElementById('view-{resource}-form').dataset.{resource}Id`.
- `form-header`'s `backHref` doubles as Cancel — **no separate Cancel/Submit footer row** inside
  the form body; Save lives in the topbar only.
- If the form attaches a related many-to-many resource (policies, permissions), add a second
  `<article class="um-form-section">` with a `<h3 class="um-section-title">` +
  `<div id="{resource}PoliciesContainer" class="um-checkbox-grid um-checkbox-grid-compact"></div>`
  — see `roles/form.ejs` / `access-keys/form.ejs`.

#### 1c. Modal include — list+modal shape only

Inline `<dialog>` markup goes at the bottom of `index.ejs`, after
`components/admin-shell/shell-close`, using `components/ui/modal-head.ejs` for the header and
Pico's own `<footer>` for Cancel/Submit (styled globally by `modal.css` — never add per-modal
footer CSS). See `views/pages/users/index.ejs` for the reference.

### Step 2 — Create static assets

#### 2a. `public/pages/{page-name}/js/entry.js`

```javascript
import './{page-name}.controller.js';
```

#### 2b. `public/pages/{page-name}/js/{page-name}.controller.js`

Page-local wiring only (window bridge + filter input listeners + the `bootAdminPage()` call —
see the Window Bridge Pattern section above). **No business logic here** — API calls, table
rendering, and form handling all live in the resource's service file (next step).

#### 2c. `public/pages/user-management/js/{resource}.service.js` — the actual logic

This is where the real work happens. Structure mirrors every existing resource
(`roles.service.js`, `access-keys.service.js`):

```javascript
import { showConfirmDialog } from '../../../js/confirm-dialog.service.js';
import { hasPermission } from '../../../js/login.service.js';
import { iamDelete, iamGet, iamPost, iamPut } from './api.js';
import { createPaginatedList } from './paginated-list.js';
import { state } from './state.js';   // add resource fields to state.js first, see Step 2d
import { showApiError, showToast } from './toast.service.js';
import { escapeHtml, refreshIcons } from './utils.js';

// ── index table — search/filter + pagination ──
const query = { search: '' };
let currentItems = [];
const pager = createPaginatedList({
  defaultPageSize: 20,
  infoId: '{resources}PagerInfo', prevId: '{resources}PrevBtn', nextId: '{resources}NextBtn',
  fetchPage: async (page, pageSize) => {
    try {
      const or = query.search ? [`{field}||$cont||${query.search}`] : undefined;
      const { items, pagination } = await iamGet('/{resources}', { page, limit: pageSize, sort: 'created_at:desc', or });
      currentItems = items;
      render{Resources}Table();
      return pagination;
    } catch (error) {
      showApiError(error, 'โหลดรายการไม่สำเร็จ');
      return undefined;   // keeps last known pagination instead of clobbering it
    }
  },
});
export function load{Resources}(page = 1) { return pager.load(page); }
export function set{Resources}Filter({ search }) { if (search !== undefined) query.search = search.trim(); pager.load(1); }
export function set{Resources}PageSize(size) { pager.setPageSize(size); }
export function goTo{Resources}Page(direction) { return pager.goToPage(direction); }

function render{Resources}Table() { /* build tbody.innerHTML from currentItems, gate action buttons with hasPermission(...) */ }

// ── create/edit form page (list+form shape) ──
export async function init{Resource}Form() {
  const form = document.getElementById('{resource}Form');
  if (!form) return;
  const {resource}Id = document.getElementById('view-{resource}-form').dataset.{resource}Id || null;
  form.dataset.editingId = {resource}Id ?? '';
  if ({resource}Id) { /* iamGet(`/{resources}/${id}`) and prefill fields */ }
}
export async function handle{Resource}FormSubmit(event) {
  event.preventDefault();
  const editingId = event.target.dataset.editingId || null;
  const payload = { /* read frm* fields */ };
  try {
    if (editingId) await iamPut(`/{resources}/${editingId}`, payload);
    else await iamPost('/{resources}', payload);
    showToast('บันทึกสำเร็จ', 'success');
    window.location.href = `${window.__IAM_VIEWS_BASE__}/{page-name}`;
  } catch (error) {
    showApiError(error, 'บันทึกไม่สำเร็จ');
  }
}

// ── delete (always via the shared confirm dialog, never window.confirm()) ──
export async function confirmDelete{Resource}(id, label) {
  const confirmed = await showConfirmDialog({ title: 'ลบ {Resource}', message: `ยืนยันการลบ "${label}"?`, confirmText: 'ลบ' });
  if (!confirmed) return;
  try {
    await iamDelete(`/{resources}/${id}`);
    showToast('ลบสำเร็จ', 'success');
    load{Resources}(pager.getCurrentPage());
  } catch (error) {
    showApiError(error, 'ลบไม่สำเร็จ');
  }
}
```

**Rules:**
- Always call `iamGet`/`iamPost`/`iamPut`/`iamDelete` from `api.js` — never raw `fetch()`. It
  handles the JSON:API envelope (`{data: {...attributes}}` → flat object) and auth headers.
- `fetchPage` reports its own errors via `showApiError` and returns `undefined` on failure —
  `createPaginatedList` keeps the last known pagination instead of clobbering it.
- Destructive actions call `showConfirmDialog(...)` — never `window.confirm()`.
- A full, un-paginated list cached for use elsewhere (e.g. a checkbox grid on another page's
  form) is its own function/cache, independent of this page's own paginated table state — see
  `ensureRolesLoaded()` / `ensurePoliciesLoaded()`. Don't let the two share state.

#### 2d. Add resource fields to `public/pages/user-management/js/state.js`

```javascript
export const state = {
  // ...
  {resource}Form: { editingId: null, selectedPolicyIds: [] },   // only if the form attaches policies
};
export function reset{Resource}FormDraft() {
  state.{resource}Form = { editingId: null, selectedPolicyIds: [] };
}
```

### Step 3 — Register page in `build-assets.mjs`

Add `adminShellPage('{page-name}')` to the `PAGES` array (see Build Pipeline section above),
then run `node apps/iam/build-assets.mjs` to confirm it bundles.

### Step 4 — Create the NestJS view controller

File: `apps/iam/src/modules/views/controllers/{page-name}.controller.ts`

```typescript
import { Controller, Get, Param, Render } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { ParseUuidParamPipe, Public } from '@lib/common';
import { ConfigService } from '@lib/config';

import { buildAdminViewConfig } from '../utils/admin-view-config.util';

@ApiExcludeController()
@Controller('views/{page-name}')
export class {PageName}ViewController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @Public()
  @Render('pages/{page-name}/index')
  page(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - {Page Title}',
      ...buildAdminViewConfig(this.configService),
    };
  }

  // list+form shape only:
  @Get('new')
  @Public()
  @Render('pages/{page-name}/form')
  newPage(): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - สร้าง {Resource} ({Page Title})',
      {resource}Id: null,
      ...buildAdminViewConfig(this.configService),
    };
  }

  @Get(':id/edit')
  @Public()
  @Render('pages/{page-name}/form')
  editPage(@Param('id', ParseUuidParamPipe) id: string): Record<string, unknown> {
    return {
      title: 'ERP IAM Admin - แก้ไข {Resource} ({Page Title})',
      {resource}Id: id,
      ...buildAdminViewConfig(this.configService),
    };
  }
}
```

**Rules:**
- `@Public()` on every route — the JWT/session gate for admin pages happens client-side, in
  `bootAdminPage({ pagePermission })`, not server-side (the HTML shell itself is not sensitive;
  the API calls it makes are what's protected).
- `@ApiExcludeController()` — view controllers aren't part of the Scalar/Swagger API surface.
- `...buildAdminViewConfig(this.configService)` — always spread this; it supplies
  `prefix`/`authApiBase`/`assetVersion`, which every shared component (`page-head`,
  `shell-open`) needs.
- `:id/edit`'s `id` param **must** use `ParseUuidParamPipe`, same as any other UUID route param
  (CLAUDE.md's UUID route param rule applies to view controllers too).

### Step 5 — Register in `ViewsModule`

File: `apps/iam/src/modules/views/views.module.ts` — add the import and add the class to
`controllers: [...]`.

### Step 6 — Add sidebar nav entry

File: `apps/iam/views/components/admin-shell/sidebar.ejs` — add under the appropriate
`<p class="um-nav-group-label">` group:

```html
<a href="/<%= prefix %>/views/{page-name}" class="um-nav-item <%= activeView === '{page-name}' ? 'active' : '' %>" data-permission="page:view_{page_name}">
    <i data-lucide="{icon}"></i><span>{Page Title}</span>
</a>
```

### Step 7 — Seed the `page:view_{page_name}` UI permission

`data-permission="page:view_{page_name}"` in the sidebar + `bootAdminPage({ pagePermission:
'page:view_{page_name}' })` both require that permission to actually exist in the `permissions`
catalog **and** be granted to at least one policy — otherwise every user (including the mock
superadmin) gets redirected straight back to the dashboard when they try to open the page.

UI-plane permissions (`page:*`, `component:*`) are **never** touched by `permissions:sync` (that
script only handles api-plane `@RequirePermission()` decorators) — they need a hand-written
migration, mirroring `SeedIamUiPermissions1784193362117` / `SeedAccessKeysUiPermission...`:

```typescript
// libs/database/src/migrations/erp_iam/<epoch_ms>-Seed{PageName}UiPermission.ts
// INSERT INTO permissions (service, permission, resource, action, plane, permission_name_th, permission_name_en)
//   VALUES ('iam', 'page:view_{page_name}', 'page_{page_name}', 'view_{page_name}', 'ui', '...', '...')
// then INSERT INTO statement_actions ... granting it to POL_SUPERADMIN_FULL_ACCESS /
// POL_STAFF_GENERAL_ACCESS's existing allow/ui statements — same shape as the migrations above.
```

If the new page also exposes REST endpoints with `@RequirePermission('{resource}:action', {
th, en })`, run `npm run permissions:sync` **after** those decorators land — it adds the
api-plane rows automatically, but still needs a similar hand-written grant migration (see
`GrantAccessKeyPermissionsToMockPolicies...`) since `permissions:sync` only touches the
`permissions` catalog, never `statement_actions`.

### Step 8 — Verify

```bash
node apps/iam/build-assets.mjs               # bundles without error
npm run migration:run:iam                    # applies the UI-permission seed migration
npx tsc -p apps/iam/tsconfig.app.json --noEmit
npm run start:dev:iam                        # boot and visit /<prefix>/views/{page-name}
```

---

## Critical Rules

### 1. EJS Include Paths

Every `include(...)` inside `views/pages/{page}/*.ejs` is relative to that file, and every
include inside `views/components/**` is relative to *that* file — `shell-open`/`shell-close`/
`page-head`/`page-foot` all live under `views/components/`, reached via `'../../components/...'`
from a page two levels deep (`pages/{page-name}/index.ejs`).

### 2. JS Files Must Be Pure — No EJS Syntax

`public/**/*.js` is bundled by esbuild, never processed by EJS. Server values flow through:
**NestJS controller return → EJS locals (`prefix`, `{resource}Id`, ...) → either a `data-*`
attribute on the page (page-specific values like `{resource}Id`) or the shared
`window.__IAM_API_BASE__`/`__IAM_VIEWS_BASE__`/`__AUTH_CONFIG__` globals → JS reads them**.
Unlike other MVC-EJS apps in this monorepo, there's no per-page `config.ejs` — one shared
`views/pages/user-management/components/config.ejs` is included once, globally, by
`page-foot.ejs`, and injects those three globals for every admin-shell page. A new page never
needs its own config include; it just reads the existing globals.

### 3. Window Bridge

Only functions called from HTML `onclick`/`onsubmit`/`onchange` attributes need
`Object.assign(window, {...})`, and it happens **once**, in `{page-name}.controller.js` — never
inside a `.service.js` file. Everything else stays a plain ES module export.

### 4. Permission String Charset

`resource`/`action` in any permission string (`@RequirePermission('x:y')` or
`data-permission="page:y"`) must match `[a-zA-Z0-9_]+` — the sync script's regex silently drops
anything with a hyphen. Use underscores (`access_key:create`), not hyphens
(`access-key:create`), even though the URL route itself is kebab-case (`/access-keys`).

### 5. List+Form Is the Default

Don't scaffold a create/edit modal on `index.ejs` unless the form is genuinely tiny or the
dialog isn't a real page (a one-time reveal, a confirm prompt). See "Two Page Shapes" above.

---

## File Checklist

```
views/pages/{page-name}/
  [ ] index.ejs                          — list: toolbar action, filters in .um-table-toolbar, table, pager
  [ ] form.ejs                           — list+form shape only: create/edit, data-{resource}-id, form-header + topbar save

public/pages/{page-name}/js/
  [ ] entry.js                           — imports {page-name}.controller.js
  [ ] {page-name}.controller.js          — window bridge, filter listeners, bootAdminPage() call(s)

public/pages/user-management/js/
  [ ] {resource}.service.js              — pager + table render + form init/submit + delete, all API calls via api.js
  [ ] state.js                           — add {resource}Form draft (if the form attaches a related resource)

apps/iam/
  [ ] build-assets.mjs                   — adminShellPage('{page-name}') added to PAGES

src/modules/views/
  [ ] controllers/{page-name}.controller.ts  — @Get() index (+ @Get('new') / @Get(':id/edit') for list+form)
  [ ] views.module.ts                        — controller added to controllers array

views/components/admin-shell/
  [ ] sidebar.ejs                        — nav item with data-permission="page:view_{page_name}"

libs/database/src/migrations/erp_iam/
  [ ] <epoch_ms>-Seed{PageName}UiPermission.ts  — seeds page:view_{page_name}, grants to mock policies
```

---

## Common Mistakes

| Mistake | Symptom | Fix |
| --- | --- | --- |
| Modal instead of `form.ejs` for anything non-trivial | Works, but diverges from every other resource page and gets flagged in review | Default to list+form; only use a modal per the exceptions in "Two Page Shapes" |
| Permission string with a hyphen (`'access-key:create'`) | `permissions:sync` reports 0 added, page/button permanently invisible/denied | Use underscores: `access_key:create` |
| New page's `page:view_{page_name}` never seeded | Every user, including the mock superadmin, gets redirected to `/dashboard` on visit | Add the `Seed{PageName}UiPermission` migration and run it |
| New api permission never granted to a policy | 403 even though `permissions:sync` added the row | `permissions:sync` only touches the catalog — add a grant migration too |
| Page not added to `build-assets.mjs`'s `PAGES` | `bundle.js`/`bundle.css` 404 | Add `adminShellPage('{page-name}')` |
| Controller not registered in `ViewsModule` | 404 visiting the page | Add to `controllers: [...]` |
| `:id/edit` param without `ParseUuidParamPipe` | Malformed UUID reaches the render instead of a clean 400 | `@Param('id', ParseUuidParamPipe) id: string` |
| Business logic written inside `{page-name}.controller.js` instead of `{resource}.service.js` | Logic isn't reusable/testable, diverges from every other page | Keep `.controller.js` to window-bridge + wiring only |
| Hand-rolled pagination bookkeeping per resource | Duplicated `currentPage`/`goToXPage` logic, drifts from other pages | Use `createPaginatedList({...})` from `paginated-list.js` |
| `window.confirm()` for a destructive action | Inconsistent styling vs. every other delete/revoke prompt | Use `showConfirmDialog({...})` from `confirm-dialog.service.js` |
| Raw `fetch()` instead of `iamGet`/`iamPost`/... | Missing auth headers, JSON:API envelope not unwrapped | Use `api.js`'s helpers |
| A cached full list (for a checkbox grid elsewhere) shares state with this page's paginated table | Selecting/filtering on one page corrupts the other's rows | Keep them as separate cache fields in `state.js`, like `roles` vs. a hypothetical paginated table cache |
