# erp-api

Backend implementation of an Enterprise ERP system — **Microservices · DDD** — built with
NestJS 11, Fastify, TypeORM, and PostgreSQL.

> The product/architecture plan lives in the [`docs/plan-erp`](docs/plan-erp) git submodule and
> is the **authoritative spec** for features, phases, and conventions. Coding conventions for
> this repo are enforced in [`CLAUDE.md`](CLAUDE.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — read
> both before opening a PR.

## Architecture overview

One NestJS app per **Bounded Context (BC)**, each with its own PostgreSQL database (database-per-
context — no cross-DB foreign keys, BCs reference each other by UUID only), its own HTTP port +
its own TCP/RabbitMQ microservice endpoint for inter-service calls. Every BC runs behind pm2 in
`cluster` mode (2 instances each — see `ecosystem.config.js`).

```mermaid
flowchart TB
    Clients([Clients])

    Clients -->|"HTTP JSON:API :3001"| Auth[auth]
    Clients -->|"HTTP JSON:API :3002"| Iam[iam]
    Clients -->|"HTTP JSON:API :3003"| Inventory[inventory-bc]
    Clients -->|"HTTP JSON:API :3004"| Supplier[supplier-bc]
    Clients -->|"HTTP JSON:API :3005"| Sales[sales-bc]
    Clients -->|"HTTP JSON:API :3006"| Finance[finance-bc]
    Clients -->|"HTTP JSON:API :3007"| Report[report-bc]
    Clients -->|"HTTP JSON:API :3008"| Storage[storage]

    Auth <-->|"TCP/RMQ: resolve perms,<br/>eval ABAC conditions"| Iam
    Auth -->|"session:&lt;jti&gt;"| Redis[(Redis)]

    Auth -.-> MQ{{RabbitMQ<br/>inter-service transport}}
    Iam -.-> MQ
    Inventory -.-> MQ
    Supplier -.-> MQ
    Sales -.-> MQ
    Finance -.-> MQ
    Report -.-> MQ
    Storage -.-> MQ

    Auth --> AuthDB[(erp_auth)]
    Iam --> IamDB[(erp_iam)]
    Inventory --> InvDB[(erp_inventory)]
    Supplier --> SupDB[(erp_supplier)]
    Sales --> SalesDB[(erp_sales)]
    Finance --> FinDB[(erp_finance)]
    Report --> RepDB[(erp_report)]
    Storage --> S3[(S3 / MinIO)]
```

| App (`apps/`) | Port | Database | Owns |
|---|---|---|---|
| `auth` | `3001` | `erp_auth` | `credentials`, `refresh_tokens`, `login_histories`, `blocked_users`, `security_logs` — **no user profile data** |
| `iam` | `3002` | `erp_iam` | `users` (source of truth), `roles`, `policies` / `policy_statements` / `statement_*`, `permissions` catalog |
| `inventory-bc` | `3003` | `erp_inventory` | products, brands, UOM, warehouses |
| `supplier-bc` | `3004` | `erp_supplier` | suppliers |
| `sales-bc` | `3005` | `erp_sales` | sales domain |
| `finance-bc` | `3006` | `erp_finance` | finance domain |
| `report-bc` | `3007` | `erp_report` | reporting (CQRS read models) |
| `storage` | `3008` | — (S3/MinIO) | file objects — stateless, no Postgres DB |

Ports/prefixes above are the `.env.example` defaults (`<BC>_MODULE_HTTP_PORT` /
`<BC>_PREFIX_NAME`) — every value is configurable per environment.

### Infrastructure & observability

Datastores (Postgres/Redis/RabbitMQ) and the observability stack (traces/logs/metrics) are plain
Docker Compose stacks under [`infrastructure/`](infrastructure) — see
[`infrastructure/README.md`](infrastructure/README.md) for how to run them. Every BC ships
structured HTTP access logs to disk (`logs/<service>/http/http.<date>.<n>.log` — see
`libs/common/src/utils/logger/pino-http.config.ts`) and OTLP traces directly to the collector;
this is how they flow into Grafana:

```mermaid
flowchart LR
    App["Every BC<br/>(pm2 cluster)"]
    LogFile[("logs/&lt;service&gt;/http/*.log")]

    App -->|"write access log"| LogFile
    App -->|"OTLP gRPC/HTTP<br/>:4317 / :4318"| Alloy[Grafana Alloy]
    LogFile -->|"tail: /var/log/erp-api/*/http/*.log"| Alloy

    Alloy -->|traces| Tempo[(Tempo)]
    Alloy -->|"logs (push)"| Loki[(Loki)]
    Prometheus["Prometheus"] -->|"scrape /metrics<br/>(otelcol_* pipeline health)"| Alloy

    Grafana{{Grafana}} --> Tempo
    Grafana --> Loki
    Grafana --> Prometheus

    App --> Postgres[(Postgres)]
    App --> Redis[(Redis)]
    App -.-> RabbitMQ{{RabbitMQ}}
```

`OTEL_EXPORTER_OTLP_ENDPOINT` (`.env`) points every app at Alloy; `TRANSPORT=rmq`/`tcp` picks
inter-service transport independently of tracing. `LOG_LEVEL` (`.env`) controls pino's verbosity;
the access-log file glob Alloy tails (`config.alloy`'s `local.file_match`) must have one `*` per
path segment the logger actually creates — see the gotcha note in
[`infrastructure/README.md`](infrastructure/README.md#observability---traces-logs-metrics) if logs
stop showing up in Loki after a logging-path change.

**Shared libs** (`libs/`):

- `@lib/common` — `@Global()` module providing `ConfigModule`, `RedisModule`, `LogModule`, a TCP
  `ClientsModule` entry per BC, `MicroserviceClientService` (no-throw `sendWithContext`), the
  global `AuthGuard` + `PermissionGuard` (registered as `APP_GUARD` — every non-`@Public()`
  endpoint in every BC is authenticated/authorized without per-app wiring), `TransformInterceptor`
  + `LocalizationInterceptor` (response shaping), `AllExceptionsFilter`/`RpcExceptionsFilter`,
  `BaseEntity`, `BaseServiceOperations`/`BaseControllerOperations` (generic CRUD), and shared
  decorators (`@RequirePermission`, `@ResourceType`, `@CurrentUser`, `@ValidatedQuery`, `@Public`).
- `@lib/config` — single Joi-validated env schema shared by every app.
- `@lib/database` — per-BC `DataSource`s (TypeORM CLI) and all migrations
  (`libs/database/src/migrations/erp_<bc>/`).
- `@lib/contracts` — FE-facing TypeScript types mirroring API response shapes.

## Identity & Access (Phase 1)

- **Auth flow**: `POST /auth/login` verifies credentials (bcrypt) against `erp_auth`, calls
  `iam` over TCP to resolve the user's profile + net permission set (RBAC → Policy → Statement,
  deny-override), issues a short-lived JWT access token + rotating refresh token, and tracks the
  session in Redis (`session:<jti>`) so logout/role-change can revoke it immediately. Roles/
  permissions live only in the Redis session blob, never in the JWT itself, so a revoked
  session or a changed role takes effect on the very next request.
- **Authorization**: RBAC (roles) + PBAC (policies made of allow/deny statements) + ABAC
  (per-statement conditions evaluated against request context — owner, department, time, IP).

### Auth middleware — guard chain (`APP_GUARD`, runs in this order on every BC)

Registered once in `libs/common/src/common.module.ts`, so every non-`@Public()` endpoint in
every BC gets all four with no per-app wiring:

| # | Guard | What it does |
|---|---|---|
| 1 | `AuthGuard` | Skips `@Public()`/`@UseAccessKey()` routes. Reads `Authorization: Bearer` (priority) or falls back to the `access_token` cookie, verifies the JWT, then re-checks the Redis session key so a revoked/logged-out session is rejected even before the JWT expires. |
| 2 | `AccessKeyGuard` | No-ops unless the route is `@UseAccessKey()` — a system-to-system/webhook auth path using an HMAC signature (`X-Access-Key-Id` + `X-Timestamp` + `X-Signature`, verified against `iam`), with Redis-backed lockout after repeated failures. Populates `request.user` itself in place of `AuthGuard` for these routes. |
| 3 | `CsrfGuard` | Double-submit cookie check for the httpOnly-cookie flow (used by the iam admin console — see below): any mutating request carrying a `csrf_token` cookie must echo it back as an `x-csrf-token` header. Bearer-only API clients never receive this cookie and are exempt. |
| 4 | `PermissionGuard` | Requires `@RequirePermission('resource:action')` on every non-`@Public()` handler — **default-deny**. Checks the JWT/session's flat `permissions` list first, falling back to a live ABAC condition-evaluation call to `iam` for permissions flagged `conditional_permissions` at login. |

- **Permission catalog**: never hand-maintained. `npm run permissions:sync` (or the **Sync
  Permissions** button on the iam admin Permissions page) scans two planes — `api`
  (`@RequirePermission('resource:action', { th, en })` calls across all BCs) and `ui`
  (`data-permission="page:*"/"component:*"` attributes in EJS views, *plus* any
  `apps/<service>/ui-permissions.manifest.json`, which wins on a key collision since it always
  carries an explicit `{ th, en }` name) — and syncs iam's `permissions` table (soft-delete on
  removal, full sync history in `permission_sync_logs`). See
  [`apps/frontend-web/ui-permissions.manifest.json`](apps/frontend-web/ui-permissions.manifest.json)
  for the manifest shape: it's a placeholder directory holding only that one file, standing in
  for a future JSX-based frontend whose compiled output leaves no literal `data-permission`
  string for the regex scan to find — a component nested under a page in the manifest inherits
  that page's derived `resource` so the Policy Generator groups them together.

### iam admin console — a separate superadmin-only web UI

`apps/iam/views` (NestJS-rendered EJS, no client framework) serves a standalone admin console at
`/iam/v1/views/*` — distinct from the JSON:API every other client consumes — intended for
Security Admins/Superadmins to manage the security core directly: `dashboard`, `users`, `roles`,
`policies`, `permissions`, `permission-sync-logs`, `access-keys`, `sessions`, `audit-logs`,
`print-templates`, `document-types`, `system-setting`. Every view controller is `@Public()` (the
HTML shell itself carries no protected data); the page's client-side JS checks the session and
hides/redirects based on `page:*`/`component:*` permissions, while every actual read/write it
performs is a normal JSON:API call that still goes through the full guard chain above via the
httpOnly cookie — so authorization is enforced the same way regardless of which UI is calling it.
It's also the repo's reference implementation for any other BC that wants its own admin UI (see
`apps/iam/views/pages/permissions/index.ejs` as the canonical list-page pattern).

Full spec: [`docs/plan-erp/srs-p1.html`](docs/plan-erp/srs-p1.html) (see §07 for the guard chain,
§08–09 for permission sync/manifest detail, §10 for session sync, §11 for CSRF/cookie auth).

## i18n (TH/EN)

DB stores flat parallel columns (`name_th` / `name_en`), never JSONB for normal fields. Input
DTOs and submit payloads use the flat keys; the `LocalizationInterceptor` collapses each pair
into a nested `{ th, en }` object on **response only**. See
[`docs/plan-erp/i18n-guide.html`](docs/plan-erp/i18n-guide.html).

## API responses

Every controller carries `@ResourceType('<plural-resource>')`; the `TransformInterceptor` wraps
the result into a JSON:API envelope: `{ status: { code, message }, data | errors, meta, links }`,
where `status.code` is a 6-digit code (`HTTP status × 1000 + serial`, e.g. `200000`).

## Getting started

### Prerequisites

- Node.js 22+, [pnpm](https://pnpm.io/)
- PostgreSQL (one database per BC — see table above)
- Redis (sessions)
- RabbitMQ (inter-service transport; set `TRANSPORT=tcp` in `.env` to fall back to direct TCP
  if unavailable)

Don't have these running locally? [`infrastructure/infra-erp`](infrastructure/infra-erp) is a
Docker Compose stack with all three — see [Infrastructure & observability](#infrastructure--observability)
above and [`infrastructure/README.md`](infrastructure/README.md) for details.

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# edit .env — DB/Redis/RabbitMQ connection details, SECRET_KEY, etc.

# 3. Pull the architecture/spec submodule
git submodule update --init --recursive

# 4. Create each BC's database, then run its migrations
npm run migration:run:auth
npm run migration:run:iam
# ...or all at once:
npm run migration:run:all

# 5. Sync the permission catalog from @RequirePermission() usage
npm run permissions:sync
```

Migrations seed a bootstrap `admin` user/role/policy in `iam` and a matching `admin` credential
in `auth` (default password `Admin@12345` — **change it after first login**).

### Run

```bash
# one service
npm run start:dev:auth
npm run start:dev:iam

# everything at once
npm run start:dev:all

# production
npm run build:auth && npm run start:prod:auth
```

Each app exposes Swagger/Scalar API docs and a `/<prefix>/health` endpoint once running (ports
and prefixes are configured per-BC in `.env`, e.g. `AUTH_MODULE_HTTP_PORT`, `IAM_PREFIX_NAME`).

### Database migrations

One `typeorm:<bc>` / `migration:run:<bc>` / `migration:generate:<bc>` / `migration:revert:<bc>`
script per BC (see `package.json`). Example for a new `iam` migration:

```bash
npm run migration:generate:iam --name=AddSomethingToRoles
npm run migration:run:iam
```

### Permissions catalog

`permissions:sync` scans both planes and syncs the result into iam's `permissions` table — run
it after adding, renaming, or removing any `@RequirePermission()` call or any `page:*`/
`component:*` usage, before wiring a policy statement to it in the Policy Generator:

- **`api` plane** — every `@RequirePermission('resource:action', { th, en })` call across all BCs.
- **`ui` plane** — `data-permission="page:*"/"component:*"` attributes in `apps/<service>/views/**`
  + `apps/<service>/public/**`, plus any `apps/<service>/ui-permissions.manifest.json` (see
  [`apps/frontend-web/ui-permissions.manifest.json`](apps/frontend-web/ui-permissions.manifest.json)
  for the shape) — the manifest is the only source for a frontend whose compiled output leaves no
  literal `data-permission` string to scan, and it wins on a key collision with the attribute scan.

```bash
npm run permissions:sync
```

Safe to re-run any time: unchanged permissions are left alone, permissions no longer found in
either source are soft-deleted (never hard-deleted), manually-added rows
(`permissions.is_manual = true`, added via the iam Permissions admin page) are never touched by
either plane's diff, and every run is logged to `permission_sync_logs` for a full add/remove
history.

### Tests & linting

```bash
pnpm test          # unit tests
pnpm test:cov      # coverage
pnpm lint          # eslint --fix
pnpm format        # prettier --write
```

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) (naming, response envelope, error handling, i18n, permissions,
Swagger conventions) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before making changes —
conventions are enforced, not optional. The
[`implement-entity`](.claude/skills/implement-entity/SKILL.md) skill documents the full workflow
(and required conventions) for adding a new entity/CRUD resource to a BC.
