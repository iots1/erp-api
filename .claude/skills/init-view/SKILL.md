---
name: init-view
description: Scaffold a new server-rendered EJS page in the notification service following the Angular-like MVC structure. Use when asked to "add new page", "create new view", "init view", "scaffold page", or "add page to notification service". Produces a fully wired page: EJS template + CSS + JS controller + NestJS controller + module registration.
---

# Init View

Scaffolds a **complete, production-ready** EJS page inside `apps/notification` using the Angular-like MVC pattern. After running this skill, the new page is accessible at `/{prefix}/views/{page-name}`.

## Project Structure Convention

Every page lives in two places — **views/** for server-rendered EJS, **public/** for static assets:

```
apps/notification/
├── views/pages/{page-name}/                    ← Server-rendered EJS templates
│   ├── index.ejs                               ← Main view (HTML shell)
│   └── components/
│       ├── config.ejs                          ← Server vars → inline <script> (bridge to JS)
│       └── {name}.component.ejs                ← UI partials (tabs, panels, modals)
│
├── public/pages/{page-name}/                   ← Source assets (bundled by esbuild)
│   ├── css/{page-name}.css                     ← Page-specific styles
│   └── js/
│       ├── entry.js                            ← Entry point (imports public-api.js or controller)
│       ├── public-api.js                       ← Complex pages only: window bridge
│       ├── {page-name}.controller.js           ← Main JS controller
│       └── {name}.service.js                   ← Optional: split by domain concern
│
├── build-assets.mjs                            ← esbuild bundler config (register new page here)
└── src/modules/views/
    ├── controllers/{page-name}.controller.ts   ← NestJS route handler
    └── views.module.ts                         ← Register controller here
```

### Build Pipeline (esbuild IIFE bundling)

Static assets under `public/` are **not served directly**. `build-assets.mjs` bundles them into `dist/public/`.

| Source (public/)              | Build Output (dist/public/)          | Served at URL                                              |
| ----------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `pages/{page}/css/*.css`     | `pages/{page}/css/bundle.css`       | `/<prefix>/assets/pages/{page}/css/bundle.css?v={hash}`    |
| `pages/{page}/js/entry.js`   | `pages/{page}/js/bundle.js`         | `/<prefix>/assets/pages/{page}/js/bundle.js?v={hash}`      |
| `css/global.css`             | `css/global.css`                    | `/<prefix>/assets/css/global.css?v={hash}`                   |

| Build mode   | Behavior                                    | Triggered by                                          |
| ------------ | ------------------------------------------- | ----------------------------------------------------- |
| Local (dev)  | Bundle + sourcemaps, **no minify**          | `NODE_ENV=local node build-assets.mjs`                  |
| Dev/Staging  | Bundle + minify                              | `node build-assets.mjs` (default)                      |
| Production   | Bundle + minify                              | `pnpm nx run notification:build`                         |
| Watch        | Auto-rebuild on `.js`/`.css` file change     | `node build-assets.mjs --watch`                          |

**JS bundling** uses `esbuild` with `format: 'iife'` + `bundle: true`:
- Follows entire ES module import graph from `entry.js`
- Wraps everything in a self-executing function (no global scope pollution)
- All module exports stay inside the IIFE — only `window` assignments are accessible from HTML

### Two Page Patterns

| Pattern | When to use | JS structure | Window bridge |
| ------- | ----------- | ------------ | ------------- |
| **Simple** | 1-2 files, no cross-module deps | `entry.js` → controller.js | `Object.assign(window, {...})` at bottom of controller |
| **Complex** | 3+ files, shared state, circular deps | `entry.js` → `public-api.js` → services | `public-api.js` is the **ONLY** file that touches `window` |

**Simple pattern** (home, socket-io, sync-lookup, playground/demo):

```javascript
// entry.js — single import
import './home.controller.js';

// home.controller.js — import shared services, assign to window at bottom
import { login, logout, getLoggedInUser } from '../../../js/login.service.js';
// ... controller logic ...
window.handleLogin  = handleLogin;
window.handleLogout = handleLogout;
```

**Complex pattern** (dynamic-form):

```javascript
// entry.js — delegates to public-api.js
import './public-api.js';

// public-api.js — imports ALL modules, single Object.assign(window, {...})
import { switchView, setLang } from './views.service.js';
import { renderFormList, ... } from './form-list.service.js';
// ... more imports ...
Object.assign(window, { switchView, setLang, renderFormList, ... });
```

### Existing Pages (use as reference)

| Page            | Views                          | Public                          | Controller                                                    | Pattern  |
| --------------- | ------------------------------ | ------------------------------- | ------------------------------------------------------------- | -------- |
| Home            | `views/pages/home/`            | `public/pages/home/`            | `src/modules/views/controllers/home.controller.ts`            | Simple   |
| Socket.IO       | `views/pages/socket-io/`       | `public/pages/socket-io/`       | `src/modules/views/controllers/socket-io.controller.ts`       | Simple   |
| Dynamic Form    | `views/pages/dynamic-form/`    | `public/pages/dynamic-form/`    | `src/modules/views/controllers/dynamic-form.controller.ts`    | Complex  |
| Sync Lookup     | `views/pages/sync-lookup/`     | `public/pages/sync-lookup/`     | `src/modules/views/controllers/sync-lookup.controller.ts`     | Simple   |
| Playground Demo | `views/pages/playground/demo/` | `public/pages/playground/demo/` | `src/modules/views/controllers/playground.controller.ts`      | Simple   |

---

## Naming Conventions

| Item               | Convention                  | Example (`queue-monitor`)                       |
| ------------------ | --------------------------- | ----------------------------------------------- |
| Directory & files  | `kebab-case`                | `queue-monitor/`, `queue-monitor.controller.ts` |
| Controller class   | `PascalCase` + `Controller` | `QueueMonitorController`                        |
| Controller route   | `'views/{page-name}'`       | `'views/queue-monitor'`                         |
| Render path        | `'pages/{page-name}/index'` | `'pages/queue-monitor/index'`                   |
| CSS file           | `{page-name}.css`           | `queue-monitor.css`                             |
| JS entry file      | `entry.js`                  | `entry.js` (always required)                    |
| JS controller file | `{page-name}.controller.js` | `queue-monitor.controller.js`                   |
| JS service files   | `{name}.service.js`         | `api.service.js`, `chart.service.js`            |
| JS public-api file | `public-api.js`             | `public-api.js` (complex pages only)             |
| Component files    | `{name}.component.ejs`      | `tab-overview.component.ejs`                    |
| CSS class prefix   | 2-3 letter page prefix      | `.qm-container`, `.qm-status-badge`             |

---

## How to Execute

> **Input required from user**: page name (kebab-case), page title, and what server-side values the JS needs.

### Step 1 — Create the view files

#### 1a. `views/pages/{page-name}/index.ejs`

```html
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title><%= title %></title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@1.0.2/css/bulma.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
        <link rel="stylesheet" href="/<%= prefix %>/assets/css/global.css?v=<%= assetVersion %>" />
        <link rel="stylesheet" href="/<%= prefix %>/assets/pages/{page-name}/css/bundle.css?v=<%= assetVersion %>" />
    </head>
    <body>
        <div style="max-width:1100px; margin:0 auto; padding:20px">
            <div class="page-header">
                <div class="badge"><i class="fas fa-icon-name"></i> Section Name</div>
                <h1><%= title %></h1>
                <p>Short description of this page</p>
            </div>

            <div style="text-align:center; margin-bottom:1.5rem">
                <a href="/<%= prefix %>/views" style="text-decoration:none">
                    <button class="p-btn p-btn-lavender">
                        <i class="fas fa-arrow-left"></i> Back to Hub
                    </button>
                </a>
            </div>

            <%- include('components/tab-overview.component.ejs') %>
        </div>

        <!-- Auth modal CSS + shared auth modal -->
        <link rel="stylesheet" href="/<%= prefix %>/assets/css/auth-modal.css?v=<%= assetVersion %>">
        <%- include('../../components/auth-modal') %>

        <!-- Scripts: config → bundle (order matters) -->
        <%- include('components/config') %>
        <script src="/<%= prefix %>/assets/pages/{page-name}/js/bundle.js?v=<%= assetVersion %>"></script>
    </body>
</html>
```

**Static asset URL prefix — mandatory:**

All static asset `<link>` and `<script>` tags **must** use `/<%= prefix %>/assets/`. This maps to the `publicDir` configured in `main.ts` via `bootstrapApplication()`.

```html
<!-- ✅ Correct -->
<link rel="stylesheet" href="/<%= prefix %>/assets/pages/{page-name}/css/bundle.css?v=<%= assetVersion %>" />
<script src="/<%= prefix %>/assets/pages/{page-name}/js/bundle.js?v=<%= assetVersion %>"></script>
<link rel="stylesheet" href="/<%= prefix %>/assets/css/global.css?v=<%= assetVersion %>" />

<!-- ❌ Wrong — will 404 -->
<link rel="stylesheet" href="/pages/{page-name}/css/bundle.css" />
```

**`?v=<%= assetVersion %>`** — cache-busting hash injected by `AssetVersionMiddleware` into `res.locals.assetVersion`. Generated by `build-assets.mjs` as SHA1 of all output files.

**Script loading order** (synchronous, must be in this exact sequence):

1. **CDN libraries** (if needed) — e.g. `<script src="https://cdn.socket.io/..."></script>`
2. **`config.ejs`** — inline `<script>` with server-injected constants
3. **`bundle.js`** — esbuild IIFE bundle containing all JS

Since scripts are placed before `</body>`, the DOM is already parsed — **do NOT use `DOMContentLoaded`** (except when dynamic content loading makes it necessary).

#### 1b. `views/pages/{page-name}/components/config.ejs`

The **bridge** between server-side EJS variables and client-side JS.

```html
<script>
    var PAGE_API_BASE = '/<%= prefix %>/views/{page-name}';
    window.__AUTH_CONFIG__ = { baseUrl: '<%= authApiBase %>/<%= authPrefix %>' };
</script>
```

**EJS output tags — critical distinction:**

| Tag            | Behavior             | Use for              | Example                                         |
| -------------- | -------------------- | -------------------- | ----------------------------------------------- |
| `<%= value %>` | HTML-escaped output  | Strings, numbers     | `'<%= socketPort %>'` → `'3012'`                |
| `<%- value %>` | Raw/unescaped output | JSON objects, arrays | `<%- JSON.stringify(data) %>` → `{"key":"val"}` |

**WARNING**: Using `<%= %>` with an object produces `[object Object]`. Always use `<%- JSON.stringify(obj) %>` for objects/arrays.

If no server values are needed by the JS, **omit config.ejs entirely** and remove its include from `index.ejs`.

#### 1c. Auth modal include (recommended for all pages)

Most pages include the shared auth modal for session-expired re-login:

```html
<link rel="stylesheet" href="/<%= prefix %>/assets/css/auth-modal.css?v=<%= assetVersion %>">
<%- include('../../components/auth-modal') %>
```

This renders the `#authLoginModal` element. The `handleAuthLogin` function is provided by `auth-guard.service.js` and must be bridged to `window` via the controller or `public-api.js`.

#### 1d. Component partials (as needed)

File: `views/pages/{page-name}/components/{name}.component.ejs`

### Step 2 — Create static assets

#### 2a. `public/pages/{page-name}/css/{page-name}.css`

Page-specific styles only. Global classes (`p-card`, `p-btn`, `p-input`, `stats-grid`, `page-header`, `badge`, `event-log`, etc.) are in `public/css/global.css`.

```css
.qm-container { max-width: 960px; margin: 0 auto; }
.qm-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 50px;
    padding: 2px 10px;
    font-size: 0.7rem;
    font-weight: 600;
}
```

**Rule**: Prefix all page classes with a 2-3 letter namespace (`.qm-`, `.df-`, `.sl-`) to avoid collisions with global classes.

#### 2b. `public/pages/{page-name}/js/{page-name}.controller.js`

**Pure JavaScript only** — no EJS syntax. All server values come from `config.ejs` constants.

Use `fetchWithAuth` (from `auth-guard.service.js`) for all authenticated API calls:

```javascript
import { fetchWithAuth } from '../../../js/auth-guard.service.js';

function loadDashboard() {
    fetchWithAuth(PAGE_API_BASE + '/stats', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    })
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function (data) { renderStats(data); })
        .catch(function (err) { console.error('Failed to load stats:', err); });
}

loadDashboard();

Object.assign(window, { loadDashboard });
```

**Rule**: Only functions called from HTML `onclick`/`onsubmit` attributes belong on `window`. Everything else stays in module scope.

#### 2c. `public/pages/{page-name}/js/entry.js` — always required

```javascript
import './{page-name}.controller.js';
```

For **complex pages**, delegate to `public-api.js` instead:

```javascript
import './public-api.js';
```

### Step 3 — Register page in build-assets.mjs

File: `apps/notification/build-assets.mjs`

Add the new page to the `PAGES` array:

```javascript
{
    name: 'queue-monitor',
    js: {
        entry: 'public/pages/queue-monitor/js/entry.js',
        out: 'pages/queue-monitor/js/bundle.js',
    },
    css: {
        entry: 'public/pages/queue-monitor/css/queue-monitor.css',
        out: 'pages/queue-monitor/css/bundle.css',
    },
},
```

**Rules:**
- `name`: matches the directory name under `public/pages/`
- `js.entry`: always points to `entry.js` (never to `.controller.js` directly)
- `js.out`: always `pages/{name}/js/bundle.js`
- `css.entry`: path to the CSS source file
- `css.out`: always `pages/{name}/css/bundle.css`
- Set `css: null` if the page has no custom CSS

### Step 4 — Create the NestJS controller

File: `apps/notification/src/modules/views/controllers/{page-name}.controller.ts`

```typescript
/* eslint-disable @typescript-eslint/naming-convention */
import { Controller, Get, Render } from '@nestjs/common';

import { Public } from '@lib/common/decorators/public.decorator';
import { ConfigService } from '@lib/config';

@Controller('views/{page-name}')
export class {PageName}Controller {
    constructor(private readonly configService: ConfigService) {}

    @Get()
    @Public()
    @Render('pages/{page-name}/index')
    page(): Record<string, unknown> {
        const nodeEnv = this.configService.get<string>('NODE_ENV', 'dev');
        const isLocal = nodeEnv === 'local';
        const domainUrl = this.configService
            .get<string>('DOMAIN_URL', 'https://api-meditech-dev.dudee-indeed.com')
            .replace(/\/$/, '');

        let apiBase: string;
        if (isLocal) {
            const host = this.configService.get<string>('BC_MODULE_MICROSERVICE_HOST', 'localhost');
            const port = this.configService.get<string>('BC_MODULE_HTTP_PORT', '3000');
            apiBase = `http://${host}:${port}`;
        } else {
            apiBase = domainUrl;
        }

        const prefix = `${this.configService.get<string>('NOTIFICATION_PREFIX_NAME', 'notification')}/${this.configService.get<string>('NOTIFICATION_PREFIX_VERSION', 'v1')}`;

        return {
            title: '{Page Title}',
            prefix,
            apiBase,
        };
    }
}
```

**Rules:**
- `@Public()` — all view pages are dev tools, not protected endpoints
- `@Render('pages/{page-name}/index')` — path relative to `views/` root, no `.ejs` extension
- **Always return `prefix`** — required for "Back to Hub" link and asset URLs
- **Always use `isLocal` / `domainUrl` pattern** — never hardcode host/port

### Step 5 — Register in ViewsModule

File: `apps/notification/src/modules/views/views.module.ts`

```typescript
import { {PageName}Controller } from './controllers/{page-name}.controller';

@Module({
    imports: [SocketModule],
    controllers: [
        HomeController,
        SocketIoController,
        SyncLookupController,
        DynamicFormController,
        {PageName}Controller,
    ],
})
export class ViewsModule {}
```

### Step 6 — Add card to Home page (optional)

Add a card to `views/pages/home/index.ejs` inside the `<div class="client-grid">`:

```html
<a href="/<%= prefix %>/views/{page-name}" style="text-decoration:none; display:flex">
    <div class="p-card" style="cursor:pointer; flex:1; display:flex; flex-direction:column; transition: transform 0.15s ease, box-shadow 0.15s ease"
        onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.1)'"
        onmouseout="this.style.transform=''; this.style.boxShadow=''">
        <div class="p-card-head">
            <div class="p-card-head-left">
                <div class="p-card-head-icon" style="background:var(--sky-lt)">
                    <i class="fas fa-icon-name" style="color:var(--sky-dk)"></i>
                </div>
                <div>
                    <div class="p-card-title">{Page Title}</div>
                    <div style="font-size:0.72rem; color:var(--text-muted)">Short subtitle</div>
                </div>
            </div>
            <i class="fas fa-arrow-right" style="color:var(--text-muted)"></i>
        </div>
        <div class="p-card-body" style="flex:1; display:flex; flex-direction:column; justify-content:space-between">
            <p style="font-size:0.83rem; color:var(--text-muted); margin:0">
                Description of what this page does.
            </p>
            <div style="margin-top:0.75rem; display:flex; gap:0.4rem; flex-wrap:wrap">
                <span class="p-tag p-tag-sky">Tag 1</span>
                <span class="p-tag p-tag-sky">Tag 2</span>
            </div>
        </div>
    </div>
</a>
```

Available color variants for tags and icons: `lavender`, `mint`, `sky`, `peach`, `pink`.

---

## Critical Rules

### 1. EJS Include Paths

```
<%- include('components/config') %>                        ✅ works — no dot in "config"
<%- include('components/tab-overview.component.ejs') %>    ✅ works — explicit .ejs
<%- include('components/tab-overview.component') %>        ❌ BROKEN — EJS sees ".component" as extension
```

**Rule:** If the filename contains a dot before `.ejs`, you **must** write the full filename including `.ejs`.

### 2. JS Files Must Be Pure

- **NEVER** use `<%= %>` or `<%- %>` inside files under `public/` — they are bundled by esbuild, not processed by EJS
- Server values flow through: **NestJS controller return → EJS `config.ejs` → global JS constants → `.js` files use them**

### 3. Script Loading Order

```
config.ejs   → defines constants (API_BASE, window.__AUTH_CONFIG__)
bundle.js   → contains ALL controller/service files (IIFE wrapped)
```

Putting `bundle.js` before `config.ejs` causes `ReferenceError: API_BASE is not defined`.

### 4. ES Modules + IIFE + Window Bridge

The build uses `esbuild` with `format: 'iife'` + `bundle: true`:
- All `import`/`export` are resolved at build time and bundled into a single IIFE
- Module-scoped variables are **not** accessible from HTML `onclick` handlers
- Only functions assigned to `window` (via `Object.assign(window, {...})`) are accessible from HTML

**For simple pages**: assign to `window` at the bottom of the controller file.
**For complex pages**: create `public-api.js` as the **single, auditable** bridge file. All other modules remain pure ESM — they `export` functions, and `public-api.js` imports and exposes them.

### 5. Auth Pattern

All pages that call authenticated APIs must:
1. Include `config.ejs` with `window.__AUTH_CONFIG__ = { baseUrl: '...' }`
2. Include the shared auth modal: `<%- include('../../components/auth-modal') %>`
3. Import `fetchWithAuth` from `auth-guard.service.js` — it auto-handles 401 with re-login modal
4. Bridge `handleAuthLogin` to `window` so the modal's `<form onsubmit>` can call it

### 6. CSS Namespace

Prefix all page-specific CSS classes to avoid collision:

| Page          | Prefix | Example                     |
| ------------- | ------ | --------------------------- |
| dynamic-form  | `.df-` | `.df-field-card`, `.df-tab` |
| sync-lookup   | `.sl-` | `.sl-progress-bar`          |
| queue-monitor | `.qm-` | `.qm-status-badge`          |

### 7. Controller Must Return `prefix`

Every view controller must return `prefix`. Omitting it causes "Back to Hub" to link to `/undefined/views`.

---

## Complex Page Module Architecture

For pages with 3+ JS files (like `dynamic-form`), follow this layered architecture:

```
entry.js
  └── public-api.js (window bridge — ONLY file that assigns to window)
        ├── constants.js     ← Static config (FIELD_TYPES, VALIDATOR_DEFS)
        ├── state.js         ← Single mutable state object (imported by all services)
        ├── utils.js         ← Pure helpers (esc, migrateField, uid)
        ├── storage.service.js  ← API layer (wraps fetchWithAuth)
        ├── views.service.js    ← Tab switching, language toggle
        ├── validation.service.js ← Form validation
        ├── {domain}.service.js  ← Business logic per concern
        └── {page}.controller.js ← Main orchestration
```

**Import order rules for multi-file pages:**
1. `constants.js` — static values referenced by other files
2. `state.js` — shared state object
3. `utils.js` — pure helper functions used everywhere
4. Services in dependency order — a service that calls another must come after it
5. `public-api.js` — imports everything, assigns to `window`

**Circular dependency resolution:**
- Use `window.switchView('builder')` instead of importing `views.service.js` in files that would create a cycle
- Use dynamic `import()` (cached as singleton promise) for `fetchWithAuth` when static import creates a cycle
- Document intentional circular deps in file header comments

---

## File Checklist

```
views/pages/{page-name}/
  [ ] index.ejs                          — links global.css + bundle.css, includes components + config + auth-modal, loads bundle.js
  [ ] components/config.ejs              — only if JS needs server values
  [ ] components/*.component.ejs         — one per major UI section

public/pages/{page-name}/
  [ ] css/{page-name}.css                — page-specific styles with namespaced classes
  [ ] js/entry.js                        — ALWAYS required
  [ ] js/{page-name}.controller.js       — pure JS, imports shared services, assigns onclick handlers to window
  [ ] js/*.service.js                    — optional, split by concern
  [ ] js/public-api.js                    — complex pages only: single window bridge file

apps/notification/
  [ ] build-assets.mjs                   — page added to PAGES array

src/modules/views/
  [ ] controllers/{page-name}.controller.ts  — returns { title, prefix, ...vars }, uses isLocal/domainUrl
  [ ] views.module.ts                        — controller added to controllers array
```

---

## Common Mistakes

| Mistake                                            | Symptom                                    | Fix                                                                        |
| -------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `include('components/x.component')` without `.ejs` | "Could not find include file" error        | Use `include('components/x.component.ejs')`                                  |
| `<%= %>` for objects in config.ejs                 | JS gets `[object Object]` or HTML entities | Use `<%- JSON.stringify(obj) %>`                                             |
| EJS syntax in `.js` file under `public/`           | Literal `<%= prefix %>` appears in browser | Move server values to `config.ejs`, reference the constant                |
| `bundle.js` loaded before `config.ejs`             | `ReferenceError: X is not defined`         | Put `config.ejs` include before `<script src="bundle.js">`                   |
| Missing `/<%= prefix %>/assets/` in asset URL      | 404 for CSS/JS files                       | Always use `/<%= prefix %>/assets/pages/{page}/css/bundle.css?v=<%= assetVersion %>` |
| Missing `prefix` in controller return              | "Back to Hub" links to `/undefined/views`  | Always return `prefix` from controller                                       |
| Controller not registered in `ViewsModule`         | 404 when visiting the page                 | Add to `controllers: [...]` in `views.module.ts`                             |
| Page not in `build-assets.mjs`                      | `bundle.js` / `bundle.css` 404             | Add page to `PAGES` array                                                    |
| `entry.js` points to `.controller.js` directly      | Auth not available on simple pages          | `entry.js` should import controller; controller imports auth services        |
| Missing `window.X = X` for onclick handlers         | `ReferenceError: X is not defined` in browser | Assign functions to `window` that are called from HTML attributes           |
| Using `fetch()` instead of `fetchWithAuth()`         | API returns 401, no auto-retry             | Import and use `fetchWithAuth` from `auth-guard.service.js`                    |
| Hardcoding `localhost:PORT` in controller          | Works locally but fails on deployed env    | Use `isLocal ? http://host:port : domainUrl` pattern                         |
| Page CSS classes collide with global               | Styles leak between pages                  | Prefix with 2-3 letter namespace (`.qm-`, `.df-`)                            |
| Circular import between service modules             | Build error or undefined at runtime        | Use `window.func()` bridge or cached dynamic `import()`                      |
