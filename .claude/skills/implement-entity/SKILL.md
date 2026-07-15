---
name: implement-entity
description: Complete 5-step workflow for implementing a new TypeORM entity in a MediTech Bounded Context microservice. Use when adding a new domain entity, creating CRUD REST API endpoints, or generating scaffolding for a resource inside an existing BC (apps/emr-bc, apps/opd-bc, apps/system-admin-bc, etc.). Triggers on requests like "implement entity X", "add entity to BC", "create CRUD for X", "scaffold resource X", "create entity and controller for X".
---

# Implement Entity

Guides through a complete 5-step workflow to implement a new entity in a MediTech Bounded Context.

## References

- **Full implementation guide with code examples** → [`references/guide.md`](references/guide.md)
  Read this for complete TypeScript examples of each step.

- **Skill metadata and conventions quick-reference** → [`references/manifest.md`](references/manifest.md)
  Read this for naming rules, key conventions, file structure, and troubleshooting.

## How to Execute

1. Ask the user for: BC name, module name, entity name, and the fields/columns needed.
2. Read [`references/guide.md`](references/guide.md) for the complete code patterns.
3. Generate all 5 steps in order — do not skip steps.
4. Verify every file against the conventions in [`references/manifest.md`](references/manifest.md).

## Critical Rules (always apply)

### Entity Rules

- **Entity**: Must extend `BaseEntity` or `RelationAuditBaseEntity` — never implement `ITimestamp`.
- **Entity**: `@Entity({ name: 'table_name', database: MeditechDatabases.MEDITECH_CORE })` — never omit `database`.
- **Entity**: No `@ApiProperty()` — Swagger decorators belong in DTOs only.
- **Entity**: Every `@Column()` must have a `comment` property for documentation.

### DTO Rules

- **Create/Update DTO**: NEVER use `?` optional marker on properties. All properties use plain type declaration (e.g., `field: string`), not `field?: string`. This ensures mock data in unit tests always has complete objects with no missing properties.
- **Create/Update DTO**: If the entity column is `nullable: true` → use union type `field: string | null` and add `@IsOptional()`.
- **Create/Update DTO**: If the entity column has a `default` value → use plain type `field: string` and add `@IsOptional()` (field is skippable but when present must be valid).
- **Response DTO**: Create a class that `extends IntersectionType(CreateDTO, BaseResponseDTO)` — import `IntersectionType` from `@nestjs/swagger` and `BaseResponseDTO` from `@lib/common/dto/base-response.dto`. This automatically includes audit fields (`id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`) in Swagger without manual duplication.

### Controller Rules

- **Controller**: Must have `@ResourceType('plural-kebab-name')` for JSON:API formatting.
- **Controller**: Every endpoint must have `@RequirePermission('resource:action', { th: '...', en: '...' })` — see **Permission Rules** below, the `{ th, en }` name is not optional in practice.
- **Controller**: Every UUID path param (`:id` or any FK-shaped param) must use `@Param('id', ParseUuidParamPipe)` — never bare `@Param('id')`. See **UUID Param Validation** below.
- **Controller**: Every method must have an explicit return type (e.g., `Promise<Entity>`, `Promise<IResponsePaginatedService<Entity[]>>`).
- **Controller**: Swagger decorators must reference Response DTOs, not Create DTOs (e.g., use `EntityResponseDTO` not `CreateEntityDTO`).
- **Controller**: Do NOT add `@ApiBearerAuth()` — authentication is configured globally in `@lib/common/utils/bootstrap.util.ts`.
- **Controller**: Always use `@Put` for update endpoints — **never `@Patch`**. All updates are full replacements.
- **Controller — Swagger strings**: Never inline API description prose in the controller. Every `@ApiOperation` summary/description, `@ApiQuery`/`@ApiBody`/`@ApiParam` description, and response description must be imported from `constants/<resource>.swagger.ts`. Use individual `UPPER_SNAKE_CASE` consts (e.g. `CREATE_<RESOURCE>_SUMMARY`) **or** one grouped object per file — pick one. Put strings shared across controllers in `constants/swagger-common.ts`. Reference: `apps/opd-bc/src/controllers/visits.proxy-controller.ts` + `apps/opd-bc/src/constants/visits.swagger.ts`.

### Permission Rules — `@RequirePermission` and the `permissions` catalog

- **Every endpoint** (except `@Public()` ones) needs `@RequirePermission('resource:action', { th, en })` — import from `@lib/common`.
- **Always pass the `{ th, en }` name** alongside the permission string:
  ```typescript
  @RequirePermission('goods_receipt:submit', { th: 'ยืนยันรับสินค้า', en: 'Submit goods receipt' })
  ```
  Without a name, `npm run permissions:sync` (see below) falls back to a humanized placeholder (e.g. `"Submit Goods_receipt"`) that an admin has to fix by hand later — just supply the real name up front.
- **The `permissions` table is not maintained by hand.** It's synced from code by `libs/database/src/scripts/sync-permissions.script.ts` (`npm run permissions:sync`), which scans every `apps/<service>/src/**/*.ts` file for `@RequirePermission(...)` calls and upserts them into iam's `permissions` table, keyed by **`(service, permission)`** — not `permission` alone, because the same `resource:action` string can legitimately mean different things in different BCs (`service` is derived from the `apps/<service>` folder name, e.g. `inventory-bc`).
  - Run it after adding/renaming/removing `@RequirePermission()` calls, before wiring a new policy in the Policy Generator — otherwise the permission won't exist in the catalog for a policy statement to reference.
  - It's safe to re-run any time: unchanged permissions are left alone, permissions no longer found in code are **soft-deleted** (never hard-deleted — nothing FK's `permissions.id` on purpose, see below), and a `permission_sync_logs` row records what was added/removed each run (audit history).
  - It **only** touches `plane = 'api'` rows. `ui` permissions (`page:*`, `component:*` — frontend `data-permission` attributes) are **not** declared via `@RequirePermission()` and must be added/edited manually in the `permissions` table; the sync script never adds, updates, or soft-deletes them.
- **`permissions.id` is intentionally not a hard FK anywhere** (e.g. `statement_actions.permission_id` is a plain `uuid` column with an index, no `FOREIGN KEY` constraint) — this lets the sync script freely soft-delete stale rows without ever failing on referential integrity.

### UUID Param Validation — `ParseUuidParamPipe`

- Every route param that is a UUID (primary `:id`, or any other id-shaped param like `:role_id`) must be validated with `ParseUuidParamPipe` from `@lib/common`:
  ```typescript
  findOne(@Param('id', ParseUuidParamPipe) id: string): Promise<Entity> { ... }
  ```
- This rejects malformed UUIDs with a proper `400002` (`InvalidParameterException`) before the request reaches the service/DB layer — without it, a bad id string either falls through to a raw Postgres `22P02` error or, worse, gets used unvalidated in a query.
- Applies to **every** `@Param()` usage across `findOne`, `update`, `softDelete`/`delete`, and any nested/custom endpoints (e.g. `:id/roles`, `:id/policies`, `:id/statements`) — not just the flat CRUD ones.

### Query Params & Relations Rules

- **When `allowedRelations` is empty** (`[]`): use plain `QueryParamsDTO` in `@ApiQuery` and `@ValidatedQuery`.
- **When `allowedRelations` is non-empty**: create a resource-specific DTO using the `queryParamsWithRelations` factory so Scalar renders `relations` as a multi-select enum dropdown.
  1. Create `constants/<resource>.constants.ts` — export `RESOURCE_ALLOWED_RELATIONS = [...] as const`
  2. Create `dto/<resource>-query-params.dto.ts` — `export class ResourceQueryParamsDTO extends queryParamsWithRelations(RESOURCE_ALLOWED_RELATIONS) {}`
  3. In the controller, replace every `QueryParamsDTO` usage (both `@ApiQuery({ type: ... })` and `@ValidatedQuery(...)`) with `ResourceQueryParamsDTO`. Remove the `QueryParamsDTO` import.
- **Single source of truth**: the constant array is referenced by both the DTO (Swagger docs) and `service.allowedRelations` (runtime validation).

### Financial Field Rules

- **Financial fields** (price, cost, amount, fee, total, etc.): Entity uses `type: 'numeric', precision: 10, scale: 4` with `transformer: new NumericTransformer()` — import from `@lib/common/transformers/numberic.transformer`.
- **Financial fields in Response DTO**: Add `@Transform(NumericTransformer.toDTO)` so PostgreSQL numeric strings are serialized as `number` in JSON.
- **Financial fields in Create/Update DTO**: Use `@IsNumber()` — no `@Transform` needed on input.

### Service Rules

- **Service**: Wrap all DB operations in `this.executeDbOperation(async () => { ... })`.

### Naming Rules

- **Properties**: `snake_case` in entities and DTOs; `PascalCase` for class names; `kebab-case` for filenames.
- **`constants/` file naming**: `*.swagger.ts` = strings that document the HTTP API (Swagger/Scalar descriptions). `*.constants.ts` = real domain constants only (enums, `*_ALLOWED_RELATIONS`, status tuples, codes). Never put API descriptions in a `*.constants.ts` — that file is misnamed and belongs as `*.swagger.ts`.
