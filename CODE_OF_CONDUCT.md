# Code of Conduct — Engineering Conventions

This is not a community-behavior policy. It is a **binding engineering standard**: every
contribution to `erp-api` — human-written or AI-assisted — must follow the conventions defined
in [`CLAUDE.md`](CLAUDE.md) and the [`docs/plan-erp`](docs/plan-erp) submodule. These are not
suggestions. Code that violates them is not mergeable, regardless of whether it "works."

## Why this exists

This repo is a multi-BC microservices monorepo maintained across many sessions and contributors
(including AI agents). Consistency is what keeps 8+ bounded contexts navigable and safe to change.
A convention violated "just this once" compounds — the next contributor copies the exception, not
the rule. Divergence in one BC quietly becomes a maintenance tax on every BC.

## Non-negotiables

The following **must never** be violated. If a task seems to require violating one, stop and
ask — do not silently work around it.

### Naming & structure
- `snake_case` for every entity/DTO property, request body, response field, query param, and
  event payload — end to end, no exceptions, no `@Column({ name: '…' })` mapping shims.
- Table/column/constraint naming exactly as specified in `CLAUDE.md`'s naming table
  (`pk_<table>`, `uq_<table>_<cols>`, `idx_<table>_<cols>`, `chk_<table>_<condition>`).
- Boolean/status properties are always prefixed (`is_`, `has_`, `can_`, `should_`) — never a
  bare adjective.
- Folder = `kebab-case`; filename = `kebab-case` + `.type.ts`; classes = `PascalCase`.

### i18n
- Bilingual fields are **flat parallel DB columns** (`*_th` / `*_en`) — never JSONB. DTOs and
  submit payloads use the flat keys. The nested `{ th, en }` shape is **response-only**, produced
  by `LocalizationInterceptor` — never hand-built in a controller or service.

### API surface
- Every controller exposing a resource carries `@ResourceType('<plural-resource>')`.
- Every non-`@Public()` endpoint carries `@RequirePermission('resource:action', { th, en })` —
  the `{ th, en }` name is mandatory, not optional, because it's synced into the `permissions`
  catalog by `npm run permissions:sync`. An endpoint with neither `@Public()` nor
  `@RequirePermission()` is a bug, not an oversight — the global guard default-denies it anyway.
- Every UUID route param uses `@Param('id', ParseUuidParamPipe)` — never a bare `@Param('id')`.
- Every `@ApiOperation`/`@ApiParam`/`@ApiQuery` description string lives in
  `constants/<resource>.swagger.ts` — never inlined in a controller.
- Controllers never `try/catch` business errors — let them bubble to `AllExceptionsFilter`. Use
  the most specific exception; never `throw new Error(...)` or a bare `new HttpException(...)`.
- Query params come through `@ValidatedQuery(QueryParamsDTO)`, never plain `@Query()`.

### Cross-context boundaries
- Database-per-BC. **No cross-database foreign keys, ever.** Reference another BC's entity by
  UUID only.
- Cross-BC calls go through `MicroserviceClientService.sendWithContext(...)` (no-throw pattern)
  — a consumer BC never imports another BC's TypeORM entities or repository directly.
- Transactional documents follow `DRAFT → SUBMITTED → CANCELLED`; domain events emit **after
  commit**, and consumers must be idempotent.

### Security
- Passwords are stored as bcrypt hashes only, in `auth`'s `credentials` table — never in `iam`,
  never in plaintext, never logged.
- `permissions.id` is never a hard foreign key elsewhere in the schema (see
  `statement_actions.permission_id`) — the sync script's soft-delete model depends on this.
- Deny always overrides allow when resolving effective permissions. Default is deny.

## Enforcement

- A PR that introduces a naming, i18n, response-envelope, permission, or cross-BC violation
  gets **change requested**, not approved with a follow-up TODO.
- `npm run lint`, `npm run test`, and (for anything touching permissions) `npm run
  permissions:sync` must be run and clean before requesting review.
- When scaffolding a new entity/CRUD resource, follow
  [`.claude/skills/implement-entity/SKILL.md`](.claude/skills/implement-entity/SKILL.md) exactly
  — it encodes these conventions as an executable checklist.

## Proposing a convention change

Conventions do change, deliberately — but never by accident inside an unrelated PR.

1. Open an issue describing the current convention, the proposed change, and the migration cost
   for existing code.
2. Get it agreed before writing code against the new convention.
3. Update `CLAUDE.md` (and `docs/plan-erp` if the change affects the spec) **in the same PR** as
   the first code that uses the new convention — the doc and the code must never drift apart.

## Standard community expectations

Beyond the engineering standard above, contributors are expected to communicate respectfully,
assume good faith in code review, and focus feedback on the code, not the person. Harassment,
personal attacks, or discriminatory language are not tolerated. Report concerns to the repository
maintainers.
