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
- **Controller**: Every endpoint must have `@RequirePermission('resource:action')`.
- **Controller**: Every method must have an explicit return type (e.g., `Promise<Entity>`, `Promise<IResponsePaginatedService<Entity[]>>`).
- **Controller**: Swagger decorators must reference Response DTOs, not Create DTOs (e.g., use `EntityResponseDTO` not `CreateEntityDTO`).
- **Controller**: Do NOT add `@ApiBearerAuth()` — authentication is configured globally in `@lib/common/utils/bootstrap.util.ts`.
- **Controller**: Always use `@Put` for update endpoints — **never `@Patch`**. All updates are full replacements.
- **Controller — Swagger strings**: Never inline API description prose in the controller. Every `@ApiOperation` summary/description, `@ApiQuery`/`@ApiBody`/`@ApiParam` description, and response description must be imported from `constants/<resource>.swagger.ts`. Use individual `UPPER_SNAKE_CASE` consts (e.g. `CREATE_<RESOURCE>_SUMMARY`) **or** one grouped object per file — pick one. Put strings shared across controllers in `constants/swagger-common.ts`. Reference: `apps/opd-bc/src/controllers/visits.proxy-controller.ts` + `apps/opd-bc/src/constants/visits.swagger.ts`.

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
