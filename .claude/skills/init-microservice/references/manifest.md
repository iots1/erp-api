# Init Microservice — Quick Reference & Checklist

## Metadata

| Field | Value |
|-------|-------|
| Name | `init-microservice` |
| Version | 1.0.0 |
| Category | Scaffolding / Infrastructure |
| Status | Stable |

## When to Use

- Creating a brand new NestJS application in the monorepo
- Adding a new Bounded Context (BC) microservice
- Scaffolding an internal service (e.g. notification, queue-manager, scheduler)

## When NOT to Use

- Adding a new entity/module to an **existing** app → use `implement-entity` skill instead
- Adding a sync-lookup feature → use `sync-lookup` skill instead
- Configuring Nx workspace patterns → use `nx-workspace-patterns` skill instead

## Quick Reference — Complete Checklist

### Files to Create/Overwrite (inside `apps/<name>/`)

| # | File | Template in guide.md |
|---|------|---------------------|
| 1 | `src/main.ts` | File 1 |
| 2 | `src/<name>.module.ts` | File 2 (Variant A or B) |
| 3 | `src/<name>.controller.ts` | Keep default |
| 4 | `src/<name>.service.ts` | Keep default |
| 5 | `src/<name>.controller.spec.ts` | Keep default |
| 6 | `jest.config.js` | File 3 |
| 7 | `project.json` | File 4 |
| 8 | `test/jest-e2e.json` | File 5 |
| 9 | `test/app.e2e-spec.ts` | File 6 |
| 10 | `tsconfig.app.json` | Keep default (generated correctly) |

### Monorepo Config Files to Update

| # | File | What to change | Template in guide.md |
|---|------|----------------|---------------------|
| 1 | `nest-cli.json` | Add project entry | File 7 |
| 2 | `libs/config/src/config.module.ts` | Add 5 Joi env vars | File 8 |
| 3 | `.env` | Add 5 env vars | File 9 |
| 4 | `.env.example` | Add 5 env vars | File 9 |
| 5 | `package.json` (root scripts) | Add 5 npm scripts | File 10 |
| 6 | `package.json` (root jest) | Add moduleNameMapper | File 11 |
| 7 | `package.json` (concurrently) | Update `start:dev:all`, `build:all` | File 10 |
| 8 | `ecosystem.config.js` | Add PM2 process entry | File 12 |

### Optional Files (if inter-service TCP is needed)

| # | File | What to change |
|---|------|----------------|
| 1 | `libs/common/src/enum/app-microservice.enum.ts` | Add `<Name>MCS` export + `AppMicroservice` entry |
| 2 | `libs/common/src/common.module.ts` | Add `ClientsModule.registerAsync` entry |

## Environment Variables Pattern

Every microservice requires exactly **5 environment variables**:

```
<SERVICE>_PREFIX_NAME=<kebab-case-name>
<SERVICE>_PREFIX_VERSION=v1
<SERVICE>_MODULE_MICROSERVICE_HOST=<host>
<SERVICE>_MODULE_MICROSERVICE_PORT=<tcp-port>
<SERVICE>_MODULE_HTTP_PORT=<http-port>
```

## Port Allocation Strategy

Check `.env` for the highest used ports:
- **Microservice (TCP)**: 5000-series (5001, 5002, ..., 5011, ...)
- **HTTP (REST)**: 3000-series (3001, 3002, ..., 3011, ...)

Always pick the **next available** port to avoid conflicts.

## npm Scripts Pattern

Every microservice gets **5 scripts** in root `package.json`:

```
start:dev:<name>     → nest start <name> --watch | pino-pretty -c -t -l
build:<name>         → nest build <name>
test:<name>          → cross-env NODE_ENV=dev jest --config ./apps/<name>/jest.config.js --watch
test:<name>:e2e      → cross-env NODE_ENV=dev jest --config ./apps/<name>/test/jest-e2e.json --watch
start:debug:<name>   → nest start <name> --debug --watch
```

## Post-Creation Developer Checklist

After the skill completes all automated steps, the developer must manually:

1. **GitLab CI/CD** → Settings → CI/CD → Variables: add the 5 env vars
2. **Kong API Gateway** → Add service + route for the new microservice
3. **Docker / docker-compose** → Add service block (if containerized)
4. **PM2 ecosystem** → Add process entry (if using PM2)

## Dependencies

- `@nestjs/cli` must be installed globally or via pnpm
- `nest g app` command must be available
- Root `webpack.config.js` must exist
- `@lib/common`, `@lib/config`, `@lib/database` libraries must exist

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `ConfigService element not found` | Missing `CommonModule` import | Add `CommonModule` to module imports |
| `request is not a function` | Wrong supertest import | Use `import request from 'supertest'` |
| `Cannot find module '@lib/common'` | Missing `moduleNameMapper` in jest config | Add all `@lib/*` and `@apps/*` mappers |
| Joi validation error on startup | Missing env vars in `.env` | Add all 5 required env vars |
| Swagger not showing DTO fields | Missing `@nestjs/swagger` plugin | Add to `nest-cli.json` compilerOptions |
| `pnpm start:dev:<name>` not found | Missing script in `package.json` | Add npm script to root package.json |
| Port already in use | Port conflict | Check `.env` and pick next available |
