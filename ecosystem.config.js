// Shared PM2 options for every BC.
//
// kill_timeout / wait_ready / listen_timeout exist to make `pm2 reload` /
// `pm2 restart` / `pm2 stop` actually graceful instead of racing NestJS's own
// shutdown sequence (see libs/common/src/utils/bootstrap.util.ts,
// registerGracefulShutdown / GracefulShutdownService):
//
//   - kill_timeout: PM2's default is 1600ms — it sends the kill_signal, waits
//     this long, then SIGKILLs. Our app's own SHUTDOWN_TIMEOUT_MS (default
//     30s, see .env / libs/config/src/config.module.ts) needs the full window
//     to drain in-flight HTTP requests, the RMQ/TCP microservice, and any
//     in-flight DB work before exiting. kill_timeout MUST stay greater than
//     SHUTDOWN_TIMEOUT_MS, or PM2 SIGKILLs before the app's own graceful
//     sequence ever finishes.
//   - wait_ready + listen_timeout: PM2 waits for the app to call
//     `process.send('ready')` (bootstrap.util.ts does this right after
//     app.listen() + microservice startup) before considering a reload's new
//     instance up. Without this, PM2 tears down the old instance the moment
//     the new process spawns — not once it can actually serve traffic.
//   - max_memory_restart: safety net against slow leaks (long-lived Node
//     process, TypeORM/Redis/RMQ connections) — PM2 restarts the app if RSS
//     exceeds this. It goes through the SAME graceful path as any other
//     restart (PM2 sends its configured kill_signal, default SIGINT, which
//     GracefulShutdownService already handles), so this is only safe now that
//     shutdown actually drains in-flight work — before this feature existed
//     it would have hit the same instant-SIGKILL problem as a normal deploy.
//     1G is a starting point, not a measured figure — tune per app once
//     there's real RSS data from monitoring.
//   - --max-old-space-size=768: caps V8's old-space heap at 768MB, BELOW
//     max_memory_restart's 1G RSS ceiling on purpose — this makes V8 throw
//     its own catchable "JavaScript heap out of memory" / trigger GC pressure
//     before PM2's cruder RSS-based kill ever fires, leaving headroom above
//     768MB for non-heap memory (buffers, native addons, process overhead)
//     that doesn't count against V8's heap limit. If an app legitimately
//     needs more heap, raise both together in its override, e.g.
//     { ...common, node_args: '--max-old-space-size=1536', max_memory_restart: '2G' }.
//
// Each BC's dist bundle is a self-contained webpack CJS build (see
// webpack.config.js — node_modules stays external, @lib/* is bundled in), so
// no --experimental-specifier-resolution / ESM loader flags are needed here.
//
// `iam` additionally serves the admin UI's static assets from
// apps/iam/dist/public (esbuild output, NOT part of `nest build`) — run
// `npm run build:assets:iam` as part of the deploy before starting/reloading
// pm2, or the view pages will 404 on their JS/CSS.
//
// exec_mode: 'cluster', instances: 2 — runs 2 workers per BC on Node's
// built-in cluster module (PM2 forks them; the master shares the one
// HTTP_PORT/MICROSERVICE_PORT across workers). Each worker is a fully
// separate process running the whole NestJS bootstrap independently (own
// GracefulShutdownService, own OTel SDK, own DB pool) — the SIGTERM/SIGINT
// handling and `wait_ready` gating documented above apply per-worker exactly
// as in fork mode, PM2 just runs more of them. Two effects worth knowing:
//   - `pm2 reload` becomes truly zero-downtime: workers are replaced one at a
//     time (old one drains via the same GracefulShutdownService sequence,
//     new one must send `ready` first), so there's always at least one
//     serving worker — unlike fork mode, where a reload is a stop-then-start.
//   - RMQ (the default TRANSPORT) already gets correct "competing consumers"
//     behavior for free — each worker opens its own consumer on the same
//     durable queue (see microservice-transport.util.ts's `prefetchCount: 1`)
//     and RabbitMQ round-robins deliveries, no extra wiring needed. TCP
//     fallback mode also works unmodified: Node's cluster module shares the
//     listening socket transparently.
//
// DB connection budget — the one thing that does NOT get automatically
// managed: each worker opens its OWN TypeORM pool (see
// libs/database/src/database.module.ts, `extra.max: 5`). Total steady-state
// ceiling per BC is `instances × extra.max`, and since every BC in this repo
// shares ONE Postgres SERVER (only the database differs — see the *_DB_HOST
// values in .env), the ceiling across the whole platform is
// `instances × extra.max × (number of BCs with a DB)`. At instances:2 that's
// 2 × 5 × 7 = 70 connections just from these pools, against Postgres's
// default `max_connections` of 100 — verify the real value with
// `SHOW max_connections;` before raising `instances` further or adding more
// BCs, and leave headroom for migrations, admin tools, and any pooler.
const common = {
  exec_mode: 'cluster',
  instances: 2,
  autorestart: true,
  watch: false,
  node_args: '--max-old-space-size=768',
  env_file: '.env',
  kill_timeout: 45000,
  wait_ready: true,
  listen_timeout: 30000,
  max_memory_restart: '1G',
};

module.exports = {
  apps: [
    { name: 'auth', script: 'dist/apps/auth/main.js', ...common },
    { name: 'iam', script: 'dist/apps/iam/main.js', ...common },
    {
      name: 'inventory-bc',
      script: 'dist/apps/inventory-bc/main.js',
      ...common,
    },
    {
      name: 'supplier-bc',
      script: 'dist/apps/supplier-bc/main.js',
      ...common,
    },
    { name: 'sales-bc', script: 'dist/apps/sales-bc/main.js', ...common },
    { name: 'finance-bc', script: 'dist/apps/finance-bc/main.js', ...common },
    { name: 'report-bc', script: 'dist/apps/report-bc/main.js', ...common },
    { name: 'storage', script: 'dist/apps/storage/main.js', ...common },
  ],
};
