# Implement Entity Skill

## Metadata

- **Name**: implement-entity
- **Version**: 1.0.0
- **Category**: Scaffolding & Code Generation
- **Status**: Stable

## Description

Complete 5-step workflow for implementing a new entity in a MediTech microservice Bounded Context. Guides through creating:

1. TypeORM Entity (extends BaseEntity)
2. DTOs (Create, Update, Response)
3. Service (extends BaseServiceOperations)
4. Controller (extends BaseControllerOperations)
5. Module configuration

## When to Use This Skill

- ✅ Adding new domain entities to a Bounded Context
- ✅ Implementing CRUD operations for a resource
- ✅ Creating new REST API endpoints
- ✅ Following MediTech entity implementation patterns
- ✅ Generating scaffolding for entities

## When NOT to Use

- ❌ Modifying existing entities (use targeted edits instead)
- ❌ Creating cross-service communication without data ownership
- ❌ Implementing complex custom logic (plan first)

## Quick Reference: 5-Step Workflow

| Step | File                                  | Key Points                                                       |
| ---- | ------------------------------------- | ---------------------------------------------------------------- |
| 1    | `entities/[entity].entity.ts`         | Extends `BaseEntity`, use `snake_case` columns                   |
| 2    | `dto/create-[entity].dto.ts`          | Use `class-validator` decorators, `@ApiProperty()` for Swagger   |
| 2b   | `dto/update-[entity].dto.ts`          | Use `OmitType + PartialType` to reuse Create DTO                 |
| 2c   | `dto/[entity]-response.dto.ts`        | Use `IntersectionType(CreateDTO, BaseResponseDTO)` for audit fields |
| 3    | `services/[entity]s.service.ts`       | Extends `BaseServiceOperations`, inject Repository/EntityManager |
| 4    | `controllers/[entity]s.controller.ts` | Extends `BaseControllerOperations`, use `@ResourceType()`        |
| 5    | `[entity].module.ts`                  | Register Controller, Service, TypeOrmModule.forFeature()         |

## Key Conventions

**Naming**:

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Properties: `snake_case`
- Primary Key: Always `id: uuid`

**Structure**:

- All columns must have comments
- Entity must extend `BaseEntity`
- Service must extend `BaseServiceOperations`
- Controller must extend `BaseControllerOperations`
- Use `@ResourceType('plural-name')` on controller

**Database**:

- Specify database in `@Entity()`: `database: MeditechDatabases.MEDITECH_CORE`
- Extends `BaseEntity` for audit fields
- Support soft deletes with `deleted_at` column

**API**:

- Controllers must use `@ResourceType()` for JSON:API formatting
- Use `@RequirePermission()` for authorization
- Use `@ValidatedQuery()` for query validation
- All responses automatically formatted by `TransformInterceptor`

## Dependencies

This skill assumes you have:

- TypeORM installed and configured
- NestJS version 11+
- @lib/common, @lib/database libraries available
- Bounded Context already created
- Module directory structure in place

## File Locations

```bash
apps/[BOUNDED_CONTEXT]/
├── src/modules/[MODULE]/
│   ├── entities/
│   │   └── [entity].entity.ts
│   ├── dto/
│   │   ├── create-[entity].dto.ts
│   │   ├── update-[entity].dto.ts
│   │   └── [entity]-response.dto.ts
│   ├── services/
│   │   └── [entity]s.service.ts
│   ├── controllers/
│   │   └── [entity]s.controller.ts
│   └── [entity].module.ts
```

## Related Documentation

- [Clean Architecture](/guides/clean-architecture.md) - Layer responsibilities, transaction patterns, when to override base methods
- [Base Operations Architecture](/guides/base-operations-architecture.md) - Filtering, sorting, pagination, and query building
- [Entity & DTO Principles](/guides/entity-dto-principle.md) - Entity and DTO standards
- [API Response & Error Handling](/guides/api-response-error-handling.md) - Response format standards
- [Naming Conventions](/guides/naming-conventions.md) - File and class naming
- [Essential Best Practices - REST API](/guides/essential-best-practices-rest-api.md) - API design patterns
- [Database Overview](/guides/database-overview.md) - Database architecture
- [Project Structure](/guides/project-structure.md) - Monorepo organization

## Example Usage

When implementing a new entity like `PatientInsurance`:

1. **Read** the comprehensive guide in `guide.md`
2. **Follow** the 5-step workflow in order
3. **Reference** the provided code examples
4. **Ensure** all naming conventions are followed
5. **Verify** entity structure with existing entities
6. **Test** CRUD operations in unit/E2E tests

## Common Patterns

### Entity with Relationships

When creating entities with relations to other data:

- If entity belongs to another BC: store `patient_id` (UUID), don't use `@ManyToOne`
- Call other BC via microservice when needed (use `MicroserviceClientService`)
- Define `allowedRelations` in service for eager loading

### Soft Deletes

Entities automatically support soft deletes via `BaseEntity`:

- `deleted_at` field tracks deletion
- Queries automatically filter deleted records
- Can restore by clearing `deleted_at`

### Validation

DTOs automatically validate via `ValidationPipe`:

- `@IsNotEmpty()` - Field required
- `@IsEmail()` - Valid email format
- `@MaxLength(50)` - String length limit
- `@IsDateString()` - Valid date format

## Notes

- All columns in entity should have descriptive comments (Thai + English recommended)
- DTOs should mirror entity structure but with API-specific validation
- Services should use `this.executeDbOperation()` wrapper for error handling
- Controllers should be thin - delegate logic to services
- Always test the 5-step implementation with unit and E2E tests

## Troubleshooting

**Issue**: Entity not found by TypeORM

- **Solution**: Verify `database` parameter in `@Entity()` matches your target database

**Issue**: DTO validation not working

- **Solution**: Ensure `@IsNotEmpty()`, `@IsString()`, etc. are imported from `class-validator`

**Issue**: Controller returning raw data instead of JSON:API format

- **Solution**: Add `@ResourceType('resource-name')` decorator to controller class

**Issue**: Authorization not enforced

- **Solution**: Add `@RequirePermission('action:resource')` to each endpoint

## Support & Feedback

For issues or improvements to this skill:

1. Check the related documentation first
2. Review existing entity implementations in the codebase
3. Refer to BaseControllerOperations and BaseServiceOperations source code
4. Consult the team standards in CLAUDE.md
