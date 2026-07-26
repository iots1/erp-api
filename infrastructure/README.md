# Infrastructure

Docker Compose stacks mirroring what's actually deployed on the `ovh-dev` server, kept here so a
new environment (staging, another dev box, a teammate's machine) can stand up the same
dependencies instead of reverse-engineering them from a running host.

| Stack | Provides | Used by |
|---|---|---|
| [`infra-erp/`](infra-erp) | PostgreSQL, Redis, RabbitMQ | every BC in this repo (`.env` `*_DB_HOST`, `REDIS_*`, `RABBITMQ_*`) |
| [`observability/`](observability) | Grafana Alloy (OTLP collector), Tempo (traces), Loki (logs), Prometheus (metrics), Grafana | `OTEL_EXPORTER_OTLP_ENDPOINT` + the per-service `logs/<bc>/http/*.log` files every BC writes (see `libs/common/src/utils/logger/pino-http.config.ts`) |

Both are plain `docker-compose.yml` files — no orchestration between them, run independently,
each in its own directory.

## `infra-erp/` — datastores

```bash
cd infrastructure/infra-erp
cp .env.example .env
# fill in POSTGRES_PASSWORD / REDIS_PASSWORD / RABBITMQ_PASSWORD
docker compose up -d
```

Creates one Postgres instance (all BCs' databases live inside it — `erp_auth`, `erp_iam`, ... —
create them once connected, see the root [`README.md`](../README.md#setup)), one Redis instance
(sessions/CSRF), one RabbitMQ instance (inter-service transport, management UI on `15672`).

The root `.env` (`AUTH_DB_*`, `REDIS_*`, `RABBITMQ_*`, ...) must point at whatever host/port/
credentials you configure here — this stack doesn't read the app's `.env`, the two are
independent and have to be kept in sync by hand.

`.env` and `data/` (bind-mounted volumes) are gitignored — never commit real credentials.

## `observability/` — traces, logs, metrics

```bash
cd infrastructure/observability
docker compose up -d
```

- **Alloy** receives OTLP traces on `4317` (gRPC) / `4318` (HTTP) — matches
  `OTEL_EXPORTER_OTLP_ENDPOINT` in the root `.env` — and tails each BC's HTTP access log
  (`logs/<service>/http/*.log`, bind-mounted read-only from the repo root by default; override
  with `ERP_API_LOGS_DIR` in a sibling `.env` if this stack runs on a different host than
  erp-api itself).
- **Tempo** stores traces, queryable on `3200`, and runs its **metrics-generator**
  (`tempo.yaml`'s `metrics_generator` + `overrides.defaults.metrics_generator.processors`):
  every ingested trace also derives `traces_spanmetrics_*` (RED metrics: call rate, error rate,
  latency) and `traces_service_graph_*` (caller→callee edges), remote-written to Prometheus —
  the data source for APM/service-graph dashboards. Requires Prometheus started with
  `--web.enable-remote-write-receiver` (set in `docker-compose.yml`'s `prometheus.command`,
  off by default on a stock image) or the writes fail silently from Tempo's side.
- **Loki** stores logs, queryable on `3100`. Alloy ships to it via `config.alloy`'s
  `loki.source.file` block — the log glob there (`/var/log/erp-api/*/http/*.log`) must have one
  `*` per path segment the app's logger actually creates; if a BC's log layout changes, update
  this glob or Alloy silently stops matching new files (no error, just an empty stream).
- **Prometheus** scrapes Alloy's own `/metrics` (component/pipeline health —
  `otelcol_receiver_*`, `otelcol_exporter_*`, ...), queryable on `9090`. Useful for community
  dashboards like [18309 "OpenTelemetry Collector Data Flow"](https://grafana.com/grafana/dashboards/18309-opentelemetry-collector-data-flow/)
  — note that dashboard was authored against an older otelcol metric-naming convention (no
  `_total` suffix on counters, `otelcol_process_*` self-metrics) and its queries need adjusting
  to Alloy's actual names (`otelcol_receiver_accepted_spans_total`, `process_cpu_seconds_total`,
  `process_resident_memory_bytes`, ...) before it'll show data.
- **Grafana** (`3000`) — all three datasources pre-provisioned via `grafana-datasources.yaml`,
  including `Tempo`'s `serviceMap`/`tracesToMetrics` wiring to Prometheus, which is what lights
  up Grafana's built-in **Service Graph** tab (Explore → Tempo → Service Graph) and the
  APM-style latency/error/rate table on a trace — no separate numbered community dashboard
  needed once metrics-generator (below) is on. Anonymous access is enabled with the Admin role
  for convenience; this is fine on an isolated dev/staging box but must not be reused as-is
  anywhere internet-reachable.
  - **Gotcha**: Grafana's file-based datasource provisioning only re-applies an entry when its
    `version:` number in the YAML *increases* — editing `jsonData` without bumping `version`
    gets silently ignored on the next Grafana restart (no error, the datasource just keeps
    whatever it already had). Always bump `version` alongside any other change here.

### Gotcha: pm2's `env_file` vs `.env` changes on the app side

Unrelated to this directory's compose files, but the thing most likely to bite when wiring an
app instance up to either stack: pm2 (`ecosystem.config.js`, `env_file: '.env'`) only reads the
app's `.env` at `pm2 start` — `pm2 restart`/`reload` reuse whatever env the process last started
with. After changing any `*_DB_HOST`, `REDIS_*`, `RABBITMQ_*`, or `OTEL_EXPORTER_OTLP_ENDPOINT`
value to point at one of these stacks, use `pm2 delete <app> && pm2 start ecosystem.config.js`
(or run [`scripts/deploy-ovh-dev.sh`](../scripts/deploy-ovh-dev.sh), which always does this),
not a plain restart/reload.
