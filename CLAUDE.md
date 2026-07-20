# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this repo is

`erp-api` — the **backend implementation** (NestJS 11) of an Enterprise ERP system
(Microservices · DDD). This repo builds the API; the product/architecture plan lives in the
`docs/plan-erp` git submodule (source: https://github.com/iots1/plan-erp) and is the
**authoritative spec** for features, phases, and conventions. Always check it before designing
a new module.

### `docs/plan-erp` — plan submodule contents

- `erp-architecture.html` — architecture & phased build plan (executive overview, bounded
  contexts, phase breakdown). Read this first to know what phase/module you're building.
- `core-feature.html` — SRS (Phase 3–6) with UC (use case) deep-dives.
- `i18n-guide.html` — bilingual (TH/EN) technical guide — read before touching any
  translatable field.
- `backend-convention.html` — full rendered backend conventions (naming / error / response /
  query). The summary below is the authoritative quick-reference; consult the HTML for detail
  or examples not covered here.
- `srs-p1.html` … `srs-p6.html` — per-phase software requirement specs.
- `CLAUDE.md` — guidance for editing the *docs* site itself (design system, Web Components).
  Not relevant to writing backend code in this repo, only to editing the plan docs.

Submodule is pinned to a commit — after `git submodule update --remote docs/plan-erp` to pull
plan changes, review the diff before relying on new content (the pin may lag `iots1/plan-erp`
main).

## Crucial project rule — bilingual i18n (TH/EN)

DB stores **flat parallel columns** `*_th` / `*_en` (never JSONB for normal fields). A NestJS
`LocalizationInterceptor` collapses each `_th/_en` pair into a nested object on **response**
(`name → { th, en }`), always emitting `{ th, en }` even when null (stable contract). **Input
(DTO) and submit payloads use flat keys** (`remark_th`, `remark_en`). Nested objects are
**response-only**. Full detail: `docs/plan-erp/i18n-guide.html`.

---

## Repo layout — bounded contexts

Nx monorepo (`apps/*` + `libs/*`, pnpm workspaces). One app per BC, each with its own Postgres
database (`ErpDatabases` enum in `@lib/common`) and its own TCP/RMQ microservice endpoint
(`AppMicroservice` enum):

| App (`apps/`) | DB | Owns |
|---|---|---|
| `auth` | `erp_auth` | `credentials`, `refresh_tokens`, `login_histories`, `blocked_users`, `security_logs` — **no user profile data** |
| `iam` | `erp_iam` | `users` (source of truth), `roles`, `policies`/`policy_statements`/`statement_*`, `permissions` catalog |
| `inventory-bc` | `erp_inventory` | products, brands, UOM, warehouses |
| `supplier-bc` | `erp_supplier` | suppliers |
| `sales-bc` | `erp_sales` | — |
| `finance-bc` | `erp_finance` | — |
| `report-bc` | `erp_report` | — |
| `storage` | none (S3/MinIO) | file objects — stateless, no Postgres DB |

`libs/common` is `@Global()` and provides `ConfigModule`, `RedisModule`, `LogModule`, a
`ClientsModule` entry per BC, `MicroserviceClientService`, and the global `AuthGuard` +
`PermissionGuard` (registered as `APP_GUARD` — every non-`@Public()` endpoint in every BC is
authenticated/authorized without per-app wiring). `libs/database` holds per-BC `DataSource`s
(for the TypeORM CLI) and all migrations under `libs/database/src/migrations/erp_<bc>/`.

## Backend conventions (NestJS 11 · Fastify · TypeORM · PostgreSQL)

Authoritative full version: `docs/plan-erp/backend-convention.html`.

### Naming

| Category | Pattern | Examples |
|---|---|---|
| Module | `Singular` + `Module` | `PatientModule`, `MedicalVisitModule` |
| Controller | `Plural` + `Controller` | `PatientsController`, `MedicalVisitsController` |
| Service | `Plural` + `Service` | `PatientsService`, `MedicalVisitsService` |
| Entity / DTO (class) | `Singular`, `PascalCase` | `Patient`, `CreatePatientDTO` |
| Entity / DTO (property) | `snake_case` | `first_name_thai`, `birth_date`, `is_active` |
| Enum | `Singular`, `PascalCase` | `QueueStatus`, `DepartmentVisitStatus` |
| Folder | `kebab-case` | `medical-visit`, `patient-change-request` |
| Filename | `kebab-case` + `.type.ts` | `medical-visit.module.ts`, `medical-visits.controller.ts` |
| Table (DB) | `plural`, `snake_case` | `patients`, `medical_visits`, `patient_insurances` |
| Column (DB) | `snake_case` | `first_name`, `birth_date`, `is_active` |
| Primary key | `id` · constraint `pk_<table>` | `id`, `pk_patients` |
| Foreign key | `singular_table_id` | `patient_id` in `medical_visits` |
| Index | `idx_<table>_<columns>` | `idx_patients_national_id` |
| Unique constraint | `uq_<table>_<columns>` | `uq_patients_hn`, `uq_users_email` |
| Check constraint | `chk_<table>_<condition>` | `chk_visits_visit_type` |

**Property names are `snake_case` end-to-end** (entities, DTOs, request bodies, responses,
query params, event payloads) so TypeORM props map 1:1 to Postgres columns — avoiding
`@Column({ name: '…' })`. This also matches the flat i18n keys (`remark_th`).

### Boolean & status prefixes (always prefix — never a bare adjective)

- `is_` — state/identity: `is_active`, `is_deleted`, `is_verified`, `is_public`.
- `has_` — possession/existence: `has_attachment`, `has_permission`, `has_signature`.
- `can_` — ability/rights: `can_edit`, `can_delete`, `can_approve`.
- `should_` — conditional action: `should_notify`, `should_archive`, `should_refresh`.

### API responses — JSON:API envelope

Every controller carries `@ResourceType('<plural-resource>')`; the `TransformInterceptor` wraps
the returned value into a **JSON:API** envelope (without the decorator, raw data is returned).

- Envelope: `{ status: { code, message }, data | errors, meta: { timestamp }, links: { self } }`.
- **`status.code` is a 6-digit code** = HTTP status × 1000 + serial; success = `200000`
  ("Request Succeeded"). Include **either `data` or `errors`, never both**.
- Shapes: **single** → `data: { type, id, attributes }` · **collection** → `data: [ … ]` ·
  **paginated** → adds `meta.pagination`.
- `attributes` carry **snake_case** props + i18n nested objects (the `LocalizationInterceptor`
  collapses `_th/_en` → `{ th, en }`). Never hand-build `{ th, en }`.

### Error handling — specific exceptions, global filter

- **Controllers never catch** — let exceptions bubble to `AllExceptionsFilter` (which shapes the
  `errors` envelope). Only catch to add controller-specific context (e.g. file upload).
- Use the **most specific** exception. Codes: `400` BadRequest (business/state) · `400001`
  `ValidationException` (body, auto via `@Body()`) · `400002` `InvalidParameterException`
  (query, via `@ValidatedQuery`) · `401` · `403` · `404` NotFound (always null-check after DB
  reads) · `409` Conflict (duplicate/constraint) · `422` Unprocessable (semantic) · `500` · `503`.
- Wrap DB work in **`executeDbOperation()`** — it maps PG codes automatically: `23505`→409,
  `23503`/`23502`/`22P02`→400, optimistic-lock→409, else→500.
- **Never expose internals** (stack/tokens). Generic client message + full **internal** log with
  context (`service`, `userId`, ids). Never `throw new Error(...)` or bare `new HttpException(...)`.

### Query params — `@ValidatedQuery`

- Use **`@ValidatedQuery(QueryParamsDTO)`** (not `@Query()`), which is type-safe and throws the
  correct `400002` (plain `@Query()` with a typed DTO wrongly triggers the global pipe → `400001`).
- Auto type-coercion (`"123"`→`123`, `"true"`→`true`), whitelist-strips unknown props, supports
  nested validation and array filter syntax `filter[]=field||$eq||value`.

### UUID route params — `ParseUuidParamPipe`

- Every UUID path param (`:id`, `:role_id`, any FK-shaped param) must use
  `@Param('id', ParseUuidParamPipe)` from `@lib/common` — never a bare `@Param('id')`. Rejects
  malformed UUIDs with `400002` before they reach the service/DB layer.

### Auth & permissions — `@RequirePermission`, `AuthGuard`/`PermissionGuard`

- Every non-`@Public()` endpoint needs `@RequirePermission('resource:action', { th, en })` —
  **always pass the `{ th, en }` name**, not just the permission string.
- `AuthGuard` + `PermissionGuard` are registered globally (`APP_GUARD` in `CommonModule`) in
  every BC: JWT verify + Redis session check, then permission check (JWT's flat `permissions`
  list first; falls back to a live ABAC condition evaluation call to iam-bc for permissions
  flagged `conditional_permissions` at login). A non-public endpoint with no
  `@RequirePermission()` is **default-denied**.
- The `permissions` catalog (iam-bc, `erp_iam.permissions`) is **not hand-maintained** — run
  `npm run permissions:sync` after adding/renaming/removing `@RequirePermission()` calls. It
  scans every `apps/<service>/src/**/*.ts`, upserts by **`(service, permission)`** (the same
  `resource:action` string can mean different things in different BCs), soft-deletes permissions
  no longer found in code (never hard-deletes — nothing FK's `permissions.id`), and logs
  add/remove history to `permission_sync_logs`. It only ever touches `plane = 'api'` rows —
  `ui` permissions (`page:*`, `component:*`, frontend `data-permission` attributes) are managed
  manually and the script never touches them.

### Migrations — generate from the entity diff, never hand-write schema

Migrations live in `libs/database/src/migrations/erp_<bc>/` and run per BC
(`pnpm run migration:run:<bc>`). Each BC has its own `migrations` table, so timestamps only
need to be ordered *within* a BC.

- **A schema change starts in the entity, not in SQL.** Edit the `*.entity.ts`, then let TypeORM
  diff the entity against the live database:

  ```bash
  pnpm run migration:generate:<bc> --name=<DescriptiveName>
  ```

  Review the generated SQL before committing — the diff is a starting point, not gospel (it can
  emit destructive `DROP`/re-create for a rename, and it reads whatever state your DB is
  actually in). Never hand-write a `CREATE TABLE`/`ALTER TABLE` migration that the generator
  could have produced: hand-written schema drifts from the entities, and the next
  `migration:generate` silently "corrects" your table back.
- **`migration:create` (hand-written) is only for what the generator cannot see**: data
  backfills, seeds, index/constraint tuning, and anything requiring ordered DML.
- **The filename timestamp must be a real `Date.now()` epoch-ms** — the value TypeORM itself
  stamps on a generated file. Never invent a round/fake number (`1752800000000`) or copy a
  neighbouring file's and bump it: the timestamp *is* the run order and the `migrations` table
  key, so a made-up one reorders or collides against migrations authored later. Hand-created
  migrations use `node -e "console.log(Date.now())"` for the same value. File is
  `<epoch_ms>-<PascalCaseName>.ts`; the class is `<PascalCaseName><epoch_ms>` and its `name`
  property must match the filename exactly.
- **`synchronize` is never `true` for a BC with migrations** (`auth`, `iam`) — it silently
  applies entity changes with no migration record and desyncs the `migrations` table from
  reality.
- `down()` must undo `up()`. When it genuinely cannot (a seed that truncates pre-existing rows),
  say so in the docblock rather than leaving a misleading no-op.
- A seed that spans two BCs must be **two migrations, one per database** (credentials in
  `erp_auth`, the user profile in `erp_iam`) — no migration may touch another BC's DB. Keep the
  linking UUIDs in sync and cross-reference the sibling file in both docblocks.

### Microservice (TCP) calls

- Use `sendWithContext(...)` — the **no-throw** pattern: returns `defaultValue`/`null` on error
  and logs consistently; the caller decides (e.g. `if (!x) throw new NotFoundException(...)`).

### Swagger/Scalar strings

- Never inline `@ApiOperation`/`@ApiParam`/`@ApiQuery` description prose in a controller — import
  from `constants/<resource>.swagger.ts` (individual `UPPER_SNAKE_CASE` consts). Strings shared
  across controllers in a BC go in `constants/swagger-common.ts`. See
  `.claude/skills/implement-entity/SKILL.md` for the full pattern.

### EJS admin views (`apps/<bc>/views`) — list-page convention

`apps/iam/views` is the reference implementation (backend-served EJS + vanilla JS, no
frontend framework) — `views/pages/permissions/index.ejs` +
`public/pages/user-management/js/permissions-admin.service.js` is the canonical example any
new BC admin UI or new list page should copy.

- **No page duplicates the breadcrumb as a title.** `components/admin-shell/topbar.ejs`
  already renders `[home icon] / pageTitle` from the `pageTitle` passed into `shell-open`. Do
  not add an `<h2 class="um-view-title">` (or similar) inside the page body repeating that
  string.
- **A list page's toolbar (`.um-toolbar`) holds only page-level action buttons** (create,
  export, refresh) — right-aligned via `components/ui/toolbar-action-button.ejs` (accepts a
  single button's fields, or a `buttons: []` array for more than one). Never hand-roll the
  `um-toolbar > um-toolbar-right > button` markup per page.
- **Search/filter controls live inside the table card**, in a `.um-table-toolbar` div directly
  above the table — never in the top-level `.um-toolbar`. A page needs at minimum a search
  `<input>` when its resource has a free-text field worth matching, plus one `<select>` per
  categorical field the backend can filter on (see permissions: search + service/plane/source
  selects). Skip a select for a field with no fixed set of values, and skip a filter entirely
  for a resource with no filterable fields.
- **The table itself is wrapped in `.um-table-scroll-area`** (sticky header, independent
  scroll) inside `<article class="um-table-card">`.
- **Every list backed by a real (non-`ignore_limit`) paginated endpoint gets
  `components/ui/pager.ejs`** inside the same `.um-table-card`, after the scroll area — pass
  `pageSizeId`/`pageSizeOptions` too ("แสดงต่อหน้า") unless the endpoint hard-codes its limit.
  A list that must load everything at once for a different consumer (e.g. `ensureRolesLoaded()`
  populating a checkbox grid elsewhere) still gets its *own* index-page table paginated
  separately — don't let the full-list cache leak into the paginated view's rows, and don't
  skip pagination on the index page just because a cached full list already exists.
- **Create/edit is a separate `form.ejs` page by default — not a modal on `index.ejs`.**
  `views/pages/{resource}/index.ejs` (list only) + `views/pages/{resource}/form.ejs` (the
  create/edit form, both cases in one file) is the default shape for any new page — mirrors
  `roles/`, `policies/`, and `access-keys/`. The view controller gets three routes: `@Get()` →
  `pages/{resource}/index`, `@Get('new')` → `pages/{resource}/form` (with `{resourceId}: null`),
  `@Get(':id/edit')` → `pages/{resource}/form` (with `{resourceId}: id`, `@Param('id',
  ParseUuidParamPipe)`). `form.ejs` uses `components/ui/form-header.ejs` (`backHref` back to the
  list, doubling as Cancel) + a topbar `save` action that calls
  `document.getElementById('{resource}Form').requestSubmit()` — no footer button row inside the
  form body. The page's root `<section>` carries `data-{resource}-id="<%= {resource}Id ?? ''
  %>"` so the JS controller's `init{Resource}Form()`
  can read it — same pattern as `initRoleForm()`. On submit, navigate back to the list with
  `window.location.href` — don't stay on the page or fake-close anything.
  Only use an in-page `<dialog>` modal instead when the form is small enough that a
  dedicated page would be pure overhead (e.g. `users/` — a handful of fields, no nested
  attach-policy checkbox grid), or for something that **isn't a navigable resource view** at
  all — e.g. the Access Key "reveal secret once" dialog, which exists only because that one API
  response can never be fetched again, not because the create form itself is a modal.
- **Modal Cancel/Submit buttons**: rely on the global `dialog footer` rule in `modal.css`
  (flex, right-aligned, same line) — never add per-modal footer CSS. A full-page `form.ejs`
  doesn't need a Cancel/Submit row at all (see above — `form-header`'s back link + the topbar
  save action cover both); `components/ui/form-actions.ejs` exists for the rarer case of a form
  embedded mid-page with no topbar action driving it, not for the standard `form.ejs` shape.
- **JS pagination bookkeeping is never hand-rolled per resource.** Every list's
  `currentPage`/`pageSize`/pager-DOM-sync/`goToXPage` lives in one place:
  `public/pages/user-management/js/paginated-list.js`'s `createPaginatedList({ fetchPage,
  infoId, prevId, nextId, defaultPageSize })`. A resource module supplies only `fetchPage(page,
  pageSize)` (build the filter/`or`, call the API, render the table, `return pagination` — or
  `return undefined` after reporting its own error, which keeps the last known pagination
  instead of clobbering it) and exports thin wrappers (`loadX`, `setXFilter`, `setXPageSize`,
  `goToXPage`) that delegate to the returned `pager`.
- **The repeated "force-reload a cached full list, then re-render, toast on failure" shape**
  (roles/policies reference-data lists used elsewhere as checkbox options) uses
  `load-list.js`'s `loadList(ensureLoaded, render, errorMessage)` instead of a hand-written
  `try/catch`.
- **A list page's rows always live in `<table class="p-table"><tbody>`** inside
  `.um-table-scroll-area` — never a hand-rolled card-grid `<div>` (e.g. a `um-policy-list` of
  `<article>` cards). Keeps every list's markup, row hover, and empty-state (`colspan` +
  `.um-empty-cell`) consistent and reusable across BCs.
- **Destructive actions (delete/revoke/etc.) call `showConfirmDialog({ title, message,
  confirmText, danger })`** (`components/ui/confirm-dialog.ejs`, included once globally in
  `page-foot.ejs`, + `public/js/confirm-dialog.service.js`) — never the native
  `window.confirm()`. It returns a `Promise<boolean>` built on the same `openModal`/`closeModal`
  as every other dialog, so destructive prompts get the same themed backdrop/animation instead
  of the browser's native popup.
- **Pico's own base rule is `td,th{background-color:var(--pico-background-color)}`** — every
  cell paints its own opaque background that sits on top of and fully hides anything set on the
  `<tr>` itself. Row background/hover/theme-specific color rules must target `.p-table tbody
  td`, not `tr` — a rule set on `tr` will visibly do nothing.
- **A `:root:not([data-theme="dark"])` (or `[data-theme="light"]`) override carries higher CSS
  specificity than a plain `.foo:hover` rule** (the `:root`/`:not()` pair each count as a class
  in specificity). A light-theme-only color override therefore needs its own explicit `:hover`
  (or other state) variant at matching-or-higher specificity alongside it, or that state
  silently stops working in light theme only — dark theme (no such override) still works, which
  is what makes this bug easy to miss.

### Cross-context rules (from the architecture)

- Database-per-context; **reference across BCs by UUID only** — no cross-DB foreign keys.
- Transactional documents are **submittable** (`DRAFT → SUBMITTED → CANCELLED`); stock/ledger
  posts on submit, reverses on cancel. Emit domain events **after commit** via an outbox;
  consumers must be idempotent. `available_qty` carries a DB `CHECK (… >= 0)`.
