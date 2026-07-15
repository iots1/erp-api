---
name: init-microservice
description: Initialize a new NestJS microservice app in the MediTech monorepo with all required configuration files, environment variables, test setup, and module registration. Use when asked to "create new app", "init microservice", "scaffold new service", "add new bounded context", or "create new BC". Produces a production-ready microservice that starts immediately with `pnpm start:dev:<name>`.
---

# Init Microservice

Scaffolds a **complete, production-ready** NestJS microservice app inside the MediTech monorepo. After running this skill, the new service compiles, starts, passes tests, and is registered in all configuration files.

## References

- **Full implementation guide** → [`references/guide.md`](references/guide.md)
- **Quick reference & checklist** → [`references/manifest.md`](references/manifest.md)

## How to Execute

> **Input required from user**: `<SERVICE_NAME>` (kebab-case, e.g. `notification`, `billing-bc`, `queue-manager`)

### Step 0 — Gather Information

Ask the user for:

1. **Service name** (kebab-case) — e.g. `notification`, `billing-bc`
2. **Port allocation** — suggest the next available ports by reading `.env` to find the highest `_MICROSERVICE_PORT` and `_HTTP_PORT` values, then +1
3. **Does this service need a database?** — if yes, ask which database(s): `MEDITECH_CORE`, `MEDITECH_MASTER`, `MEDITECH_IAM`
4. **Does this service need to be called by other services via TCP?** — if yes, it needs an `AppMicroservice` entry and `CommonModule` client registration
5. **Does this service expose REST API endpoints with Swagger?** — almost always yes → add `@nestjs/swagger` plugin and `webpackConfigPath` in `nest-cli.json`

### Step 1 — Generate the NestJS App

```bash
nest g app <service-name>
```

This creates the base structure under `apps/<service-name>/` but with defaults that **must be overwritten** in the following steps.

### Step 2 — Overwrite Generated Files (9 files)

Follow the templates in [`references/guide.md`](references/guide.md) to create/overwrite:

| #   | File                                        | Action                                                                    |
| --- | ------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | `apps/<name>/src/main.ts`                   | **Overwrite** — use `bootstrapApplication()`                              |
| 2   | `apps/<name>/src/<name>.module.ts`          | **Overwrite** — import `CommonModule` (+ `DatabaseModule` if DB needed)   |
| 3   | `apps/<name>/src/<name>.controller.ts`      | Keep or overwrite (default is fine for hello-world)                       |
| 4   | `apps/<name>/src/<name>.service.ts`         | Keep or overwrite                                                         |
| 5   | `apps/<name>/src/<name>.controller.spec.ts` | Keep (default is fine)                                                    |
| 6   | `apps/<name>/jest.config.js`                | **Overwrite** — add `moduleNameMapper`, `displayName`, `testMatch`        |
| 7   | `apps/<name>/project.json`                  | **Overwrite** — Nx targets: build, serve, test, test:e2e                  |
| 8   | `apps/<name>/test/jest-e2e.json`            | **Overwrite** — add `moduleNameMapper` with 3-level paths                 |
| 9   | `apps/<name>/test/app.e2e-spec.ts`          | **Overwrite** — fix supertest import to `import request from 'supertest'` |

> `tsconfig.app.json` is generated correctly by `nest g app` — no changes needed.

### Step 3 — Register in Monorepo Configuration (6 files)

| #   | File                               | What to add                                                                                 |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | `nest-cli.json`                    | Add project entry with `plugins: ["@nestjs/swagger"]` and `webpackConfigPath` (if REST API) |
| 2   | `libs/config/src/config.module.ts` | Add Joi validation for 5 env vars                                                           |
| 3   | `.env`                             | Add 5 environment variables with allocated ports                                            |
| 4   | `.env.example`                     | Add same 5 environment variables                                                            |
| 5   | `package.json` (root)              | Add scripts: `start:dev`, `build`, `test`, `test:e2e`, `start:debug`                        |
| 6   | `ecosystem.config.js`              | Add PM2 process entry for production deployment                                             |

### Step 4 — Update Concurrently Scripts

In root `package.json`, add the new service to:

- `start:dev:all` (concurrently command)
- `build:all` (for loop)

### Step 5 — Optional: Register as Microservice Client

**Only if other services need to call this service via TCP:**

1. Add `export const <Name>MCS` to `libs/common/src/enum/app-microservice.enum.ts`
2. Add to `AppMicroservice` object in the same file
3. Register client in `libs/common/src/common.module.ts` → `ClientsModule.registerAsync([])`

### Step 6 — Verify

```bash
pnpm start:dev:<service-name>
```

The service must start without errors and show:

- Swagger docs at `http://localhost:<HTTP_PORT>/<prefix>/v1/api-docs`
- Microservice listening on TCP port (if configured)

### Step 7 — Notify Developer

After successful creation, print this checklist:

```
✅ Microservice "<service-name>" created successfully!

📋 Manual steps required:
  1. GitLab CI/CD — Add these environment variables to your GitLab CI/CD Settings → Variables:
     • <SERVICE_ENV_PREFIX>_PREFIX_NAME
     • <SERVICE_ENV_PREFIX>_PREFIX_VERSION
     • <SERVICE_ENV_PREFIX>_MODULE_MICROSERVICE_HOST
     • <SERVICE_ENV_PREFIX>_MODULE_MICROSERVICE_PORT
     • <SERVICE_ENV_PREFIX>_MODULE_HTTP_PORT

  2. Kong API Gateway — Add a new service + route:
     • Service name: <service-name>
     • Service URL:  http://<service-name>:<HTTP_PORT>
     • Route path:   /<prefix>/v1/*

  3. Docker / docker-compose — Add the new service block if using containerized deployment.
```

## Critical Rules

- **ALWAYS** use `bootstrapApplication()` from `@lib/common/utils/bootstrap.util` — never write manual NestJS bootstrap
- **ALWAYS** import `CommonModule` in the root module — it provides ConfigService, guards, JWT, Redis, BullMQ, and all microservice clients
- **ALWAYS** fix the e2e test supertest import to `import request from 'supertest'` (NOT `import * as request`)
- **ALWAYS** add `moduleNameMapper` to both `jest.config.js` and `test/jest-e2e.json` — missing this causes `Cannot find module '@lib/common'`
- **ALWAYS** add `transformIgnorePatterns: ['/node_modules/(?!uuid)']` to jest configs
- **NEVER** set ports that conflict with existing services — always check `.env` first
- **nest-cli.json**: Add `plugins: ["@nestjs/swagger"]` and `webpackConfigPath: "webpack.config.js"` for services exposing REST endpoints
- **Environment variable naming**: Use `SCREAMING_SNAKE_CASE`, pattern: `<SERVICE>_PREFIX_NAME`, `<SERVICE>_PREFIX_VERSION`, `<SERVICE>_MODULE_HTTP_PORT`, `<SERVICE>_MODULE_MICROSERVICE_HOST`, `<SERVICE>_MODULE_MICROSERVICE_PORT`

## Naming Convention Quick Reference

| Item                | Convention                     | Example (`billing-bc`)        |
| ------------------- | ------------------------------ | ----------------------------- |
| Directory           | `kebab-case`                   | `apps/billing-bc/`            |
| Module class        | `PascalCase` + `Module`        | `BillingBCModule`             |
| Controller class    | `PascalCase` + `Controller`    | `BillingBCController`         |
| Service class       | `PascalCase` + `Service`       | `BillingBCService`            |
| Env prefix          | `SCREAMING_SNAKE`              | `BILLING_BC`                  |
| Env port vars       | `<PREFIX>_MODULE_HTTP_PORT`    | `BILLING_BC_MODULE_HTTP_PORT` |
| Main.ts prefix env  | `<PREFIX>_PREFIX_NAME`         | `BILLING_BC_PREFIX_NAME`      |
| jest displayName    | `<name>:unit` / `<name>:e2e`   | `billing-bc:unit`             |
| Nx project name     | same as directory              | `billing-bc`                  |
| Microservice const  | `PascalCase` + `MCS`           | `BillingBcMCS`                |
| AppMicroservice key | `PascalCase`                   | `BillingBc`                   |
| DI token            | `SCREAMING_SNAKE` + `_SERVICE` | `BILLING_BC_SERVICE`          |

## Common Mistakes

| Mistake                                | Fix                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Missing `CommonModule` import          | Module fails: `ConfigService element not found`                                |
| `import * as request from 'supertest'` | E2E fails: `request is not a function` → use `import request from 'supertest'` |
| No `moduleNameMapper` in jest-e2e.json | E2E fails: `Cannot find module '@lib/common'`                                  |
| Port conflict with existing service    | Check `.env` for highest port and use next available                           |
| Missing env vars in `config.module.ts` | App crashes on startup with Joi validation error                               |
| Forgot `nest-cli.json` swagger plugin  | Swagger decorators not processed at compile time                               |
| Forgot scripts in root `package.json`  | `pnpm start:dev:<name>` doesn't exist                                          |
