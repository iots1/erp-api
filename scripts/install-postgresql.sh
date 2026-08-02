#!/usr/bin/env bash
# Install PostgreSQL (default: 18) on a Debian/Ubuntu host from the official
# PGDG apt repo, with a --mode switch to also wire up native streaming
# replication. Meant to be copied to / run directly on the target server
# (not run from this repo) so the same script can be reused for every node
# in a primary + replica(s) cluster.
#
# Modes:
#   standalone – single instance, no replication wiring (default)
#   primary    – configure as a replication source: wal_level, pg_hba entries
#                for each replica CIDR, a REPLICATION role (password
#                auto-generated + saved locally unless supplied)
#   replica    – wipe the local (freshly-installed, still-empty) cluster and
#                pg_basebackup-clone it from a primary, then start in standby
#
# Idempotent: safe to re-run on the same host — an already-installed package,
# an existing role, or an existing pg_hba line is detected and skipped rather
# than duplicated.
#
# ---------------------------------------------------------------------------
# Usage examples (run as root / via sudo on the target server):
#
#   # single standalone instance, no replication
#   ./install-postgresql.sh --mode=standalone
#
#   # primary — allow these two replica IPs to stream from it
#   ./install-postgresql.sh --mode=primary \
#     --allowed-cidrs=172.16.0.222/32,172.16.0.223/32
#   # -> prints + saves the generated replication password to
#   #    /root/.pg_replication/replicator.password (chmod 600)
#
#   # replica — clone from the primary above (run once per replica host).
#   # scp the password file saved on the primary to the same default path
#   # first, or pass --repl-password-file explicitly:
#   #   scp ovh-ppm:/root/.pg_replication/replicator.password /root/.pg_replication/
#   ./install-postgresql.sh --mode=replica \
#     --primary-host=172.16.0.221 \
#     --replication-slot=ppr1_slot \
#     --force
#
# Run with --help for the full flag reference.
# ---------------------------------------------------------------------------

set -euo pipefail

# ---- defaults ---------------------------------------------------------

MODE=""
PG_VERSION="18"
CLUSTER="main"
PORT="5432"
LISTEN_ADDRESSES=""
REPL_USER="replicator"
REPL_PASSWORD=""
REPL_PASSWORD_FILE=""
ALLOWED_CIDRS=""
APP_CIDRS=""
APP_USER="postgres"
REPLICATION_SLOT=""
PRIMARY_HOST=""
PRIMARY_PORT="5432"
FORCE="false"

# ---- helpers ------------------------------------------------------------

log()  { printf '==> %s\n' "$*"; }
warn() { printf '!! %s\n' "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,/^set -euo pipefail/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
  cat <<'EOF'

Flags:
  --mode=standalone|primary|replica   (required)
  --pg-version=N                      PostgreSQL major version (default: 18)
  --port=N                            PostgreSQL port (default: 5432)
  --listen-addresses=ADDR             default: '*' for primary, 'localhost' otherwise
  --repl-user=NAME                    replication role name (default: replicator)
  --repl-password=SECRET              explicit replication password (else generated/read from file)
  --repl-password-file=PATH           read/write the replication password here
                                       (default: /root/.pg_replication/<repl-user>.password)
  --allowed-cidrs=CIDR[,CIDR...]      [primary] client CIDRs allowed to stream (required)
  --app-cidrs=CIDR[,CIDR...]          [primary] client CIDRs allowed to connect as --app-user
                                       for normal (non-replication) app traffic, e.g. the BC
                                       app servers' IPs — without this, only replicas can reach
                                       the primary and every app connection is hba-rejected
  --app-user=NAME                     [primary] db user app-cidrs are granted access for (default: postgres)
  --replication-slot=NAME             [primary+replica] physical replication slot to use
  --primary-host=HOST                 [replica] primary host/IP to clone from (required)
  --primary-port=N                    [replica] primary port (default: 5432)
  --force                             [replica] allow wiping a non-empty data directory
  -h, --help                          show this help
EOF
}

require_root() {
  [ "$(id -u)" -eq 0 ] || die "must run as root (sudo ./install-postgresql.sh ...)"
}

# ---- arg parsing ----------------------------------------------------------

for arg in "$@"; do
  case "$arg" in
    --mode=*)               MODE="${arg#*=}" ;;
    --pg-version=*)         PG_VERSION="${arg#*=}" ;;
    --port=*)                PORT="${arg#*=}" ;;
    --listen-addresses=*)   LISTEN_ADDRESSES="${arg#*=}" ;;
    --repl-user=*)           REPL_USER="${arg#*=}" ;;
    --repl-password=*)      REPL_PASSWORD="${arg#*=}" ;;
    --repl-password-file=*) REPL_PASSWORD_FILE="${arg#*=}" ;;
    --allowed-cidrs=*)      ALLOWED_CIDRS="${arg#*=}" ;;
    --app-cidrs=*)          APP_CIDRS="${arg#*=}" ;;
    --app-user=*)           APP_USER="${arg#*=}" ;;
    --replication-slot=*)   REPLICATION_SLOT="${arg#*=}" ;;
    --primary-host=*)       PRIMARY_HOST="${arg#*=}" ;;
    --primary-port=*)       PRIMARY_PORT="${arg#*=}" ;;
    --force)                FORCE="true" ;;
    -h|--help)               usage; exit 0 ;;
    *) die "unknown flag: $arg (see --help)" ;;
  esac
done

case "$MODE" in
  standalone|primary|replica) ;;
  "") die "missing --mode=standalone|primary|replica (see --help)" ;;
  *)  die "invalid --mode='$MODE' (must be standalone, primary, or replica)" ;;
esac

[ -n "$LISTEN_ADDRESSES" ] || LISTEN_ADDRESSES="$([ "$MODE" = "primary" ] && echo '*' || echo 'localhost')"
[ -n "$REPL_PASSWORD_FILE" ] || REPL_PASSWORD_FILE="/root/.pg_replication/${REPL_USER}.password"

if [ "$MODE" = "primary" ] && [ -z "$ALLOWED_CIDRS" ]; then
  die "--mode=primary requires --allowed-cidrs=CIDR[,CIDR...] (e.g. --allowed-cidrs=172.16.0.222/32,172.16.0.223/32)"
fi
if [ "$MODE" = "primary" ] && [ -z "$APP_CIDRS" ]; then
  warn "--app-cidrs not set — only --allowed-cidrs (replication) will be able to connect;" \
       "every normal app connection (e.g. from a BC server) will be pg_hba-rejected until" \
       "you pass --app-cidrs=CIDR[,CIDR...] and re-run"
fi
if [ "$MODE" = "replica" ] && [ -z "$PRIMARY_HOST" ]; then
  die "--mode=replica requires --primary-host=HOST"
fi

require_root

DATA_DIR="/var/lib/postgresql/${PG_VERSION}/${CLUSTER}"
CONF_DIR="/etc/postgresql/${PG_VERSION}/${CLUSTER}"
SERVICE="postgresql@${PG_VERSION}-${CLUSTER}"

# ---- install ---------------------------------------------------------

detect_codename() {
  . /etc/os-release
  [ -n "${VERSION_CODENAME:-}" ] || die "could not detect distro codename from /etc/os-release"
  echo "$VERSION_CODENAME"
}

ensure_pgdg_repo() {
  local codename keyring repo_line
  codename="$(detect_codename)"
  keyring="/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc"
  repo_line="deb [signed-by=${keyring}] https://apt.postgresql.org/pub/repos/apt ${codename}-pgdg main"

  if [ -f /etc/apt/sources.list.d/pgdg.list ] && grep -qF "$repo_line" /etc/apt/sources.list.d/pgdg.list 2>/dev/null; then
    return 0
  fi

  log "adding PGDG apt repo (${codename}-pgdg)"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates gnupg >/dev/null
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL -o "$keyring" https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "$repo_line" > /etc/apt/sources.list.d/pgdg.list
}

install_postgresql() {
  if dpkg -s "postgresql-${PG_VERSION}" >/dev/null 2>&1; then
    log "postgresql-${PG_VERSION} already installed, skipping install"
    return 0
  fi
  ensure_pgdg_repo
  log "installing postgresql-${PG_VERSION}"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}" "postgresql-contrib-${PG_VERSION}" >/dev/null
}

# ---- config helpers ---------------------------------------------------

pg_set() { pg_conftool "$PG_VERSION" "$CLUSTER" set "$1" "$2"; }

ensure_hba_line() {
  local line="$1" hba="${CONF_DIR}/pg_hba.conf"
  grep -qF "$line" "$hba" 2>/dev/null || echo "$line" >> "$hba"
}

reload_service() { systemctl reload "$SERVICE"; }
restart_service() { systemctl enable --now "$SERVICE" >/dev/null; systemctl restart "$SERVICE"; }

generate_password() {
  openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 24
}

resolve_repl_password() {
  # explicit --repl-password wins; else read an existing password file; else
  # generate one and persist it so reruns and `scp`-to-replica stay stable.
  if [ -n "$REPL_PASSWORD" ]; then
    return 0
  fi
  if [ -f "$REPL_PASSWORD_FILE" ]; then
    REPL_PASSWORD="$(cat "$REPL_PASSWORD_FILE")"
    log "reusing existing replication password from ${REPL_PASSWORD_FILE}"
    return 0
  fi
  REPL_PASSWORD="$(generate_password)"
  install -d -m 700 "$(dirname "$REPL_PASSWORD_FILE")"
  printf '%s' "$REPL_PASSWORD" > "$REPL_PASSWORD_FILE"
  chmod 600 "$REPL_PASSWORD_FILE"
  log "generated replication password, saved to ${REPL_PASSWORD_FILE} (copy this file to each replica)"
}

# ---- mode: common base config -----------------------------------------

configure_common() {
  log "applying base config (port=${PORT}, listen_addresses=${LISTEN_ADDRESSES})"
  # pg_conftool quotes string values itself (via quote_conf_value) — passing
  # an already-quoted value here double-quotes it, e.g. listen_addresses
  # ends up literally set to '*' (quote-star-quote) instead of *.
  pg_set port "$PORT"
  pg_set listen_addresses "$LISTEN_ADDRESSES"
}

# ---- mode: primary ------------------------------------------------------

configure_primary() {
  resolve_repl_password

  log "applying replication config for primary"
  pg_set wal_level replica
  pg_set max_wal_senders 10
  pg_set max_replication_slots 10
  pg_set hot_standby on

  restart_service

  log "ensuring replication role '${REPL_USER}' exists with the current password"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${REPL_USER}') THEN
    CREATE ROLE ${REPL_USER} WITH REPLICATION LOGIN PASSWORD '${REPL_PASSWORD}';
  ELSE
    ALTER ROLE ${REPL_USER} WITH REPLICATION LOGIN PASSWORD '${REPL_PASSWORD}';
  END IF;
END
\$\$;
SQL

  log "adding replication pg_hba entries for: ${ALLOWED_CIDRS}"
  IFS=',' read -ra cidrs <<< "$ALLOWED_CIDRS"
  for cidr in "${cidrs[@]}"; do
    ensure_hba_line "host    replication     ${REPL_USER}     ${cidr}     scram-sha-256"
  done

  if [ -n "$APP_CIDRS" ]; then
    log "adding app pg_hba entries (user=${APP_USER}) for: ${APP_CIDRS}"
    IFS=',' read -ra app_cidrs <<< "$APP_CIDRS"
    for cidr in "${app_cidrs[@]}"; do
      ensure_hba_line "host    all             ${APP_USER}     ${cidr}     scram-sha-256"
    done
  fi

  if [ -n "$REPLICATION_SLOT" ]; then
    log "ensuring physical replication slot '${REPLICATION_SLOT}' exists"
    sudo -u postgres psql -v ON_ERROR_STOP=1 -tAc \
      "SELECT 1 FROM pg_replication_slots WHERE slot_name = '${REPLICATION_SLOT}'" | grep -q 1 || \
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c \
      "SELECT pg_create_physical_replication_slot('${REPLICATION_SLOT}')" >/dev/null
  fi

  reload_service

  cat <<EOF

==> primary ready on port ${PORT}
    replication user : ${REPL_USER}
    password file     : ${REPL_PASSWORD_FILE}   (copy this to each replica)
    replication CIDRs : ${ALLOWED_CIDRS}
    app CIDRs         : ${APP_CIDRS:-none (no non-replica host can connect!)}
    app user          : ${APP_USER}
    replication slot  : ${REPLICATION_SLOT:-none}
EOF
}

# ---- mode: replica ------------------------------------------------------

configure_replica() {
  resolve_repl_password

  if [ -n "$(find "$DATA_DIR" -mindepth 1 -print -quit 2>/dev/null)" ] && [ "$FORCE" != "true" ]; then
    die "${DATA_DIR} is not empty — pass --force to wipe it and clone from the primary (destructive!)"
  fi

  log "stopping ${SERVICE} and clearing ${DATA_DIR}"
  systemctl stop "$SERVICE" || true
  find "$DATA_DIR" -mindepth 1 -delete

  log "cloning from primary ${PRIMARY_HOST}:${PRIMARY_PORT} via pg_basebackup"
  slot_args=()
  [ -n "$REPLICATION_SLOT" ] && slot_args=(-S "$REPLICATION_SLOT" -C)

  PGPASSWORD="$REPL_PASSWORD" sudo -E -u postgres pg_basebackup \
    -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" -U "$REPL_USER" \
    -D "$DATA_DIR" -Fp -Xs -P -R "${slot_args[@]}"

  configure_common

  log "starting ${SERVICE} as standby"
  restart_service

  cat <<EOF

==> replica ready, streaming from ${PRIMARY_HOST}:${PRIMARY_PORT}
    replication slot : ${REPLICATION_SLOT:-none}
    verify with       : sudo -u postgres psql -tAc 'SELECT pg_is_in_recovery();'
EOF
}

# ---- main ---------------------------------------------------------------

install_postgresql

case "$MODE" in
  standalone)
    configure_common
    restart_service
    log "standalone instance ready on port ${PORT}"
    ;;
  primary)
    configure_common
    configure_primary
    ;;
  replica)
    # configure_replica applies the base config itself, after basebackup
    # (pg_basebackup -R writes into $DATA_DIR; conf lives separately in /etc
    # and must be applied only once the cluster is running the cloned data).
    configure_replica
    ;;
esac

log "done"
