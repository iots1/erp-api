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

## Backend conventions (NestJS 11 · Fastify · TypeORM · PostgreSQL)

Authoritative full version: `docs/plan-erp/backend-convention.html`. This repo currently only
scaffolds Express (`@nestjs/platform-express`); switch to Fastify (`@nestjs/platform-fastify`)
and add TypeORM + PostgreSQL when implementation starts, per the plan.

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

### Microservice (TCP) calls

- Use `sendWithContext(...)` — the **no-throw** pattern: returns `defaultValue`/`null` on error
  and logs consistently; the caller decides (e.g. `if (!x) throw new NotFoundException(...)`).

### Cross-context rules (from the architecture)

- Database-per-context; **reference across BCs by UUID only** — no cross-DB foreign keys.
- Transactional documents are **submittable** (`DRAFT → SUBMITTED → CANCELLED`); stock/ledger
  posts on submit, reverses on cancel. Emit domain events **after commit** via an outbox;
  consumers must be idempotent. `available_qty` carries a DB `CHECK (… >= 0)`.
