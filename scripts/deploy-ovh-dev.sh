#!/usr/bin/env bash
# Deploy erp-api to the ovh-dev server: git is the source of truth — any
# local edit on the server (hotfix, stray scp, whatever) is discarded via
# `git reset --hard` to match origin — then install deps, build every BC +
# iam's admin-UI assets, then bounce pm2. `.env` is gitignored so it is never
# touched by the reset/clean and always reflects whatever is already on the
# server.
#
# Usage:
#   ./scripts/deploy-ovh-dev.sh              # reset to origin/<whatever branch the server is on>
#   ./scripts/deploy-ovh-dev.sh main          # checkout + reset to origin/main
#
# Requires: `ssh ovh-dev` already configured (host alias in ~/.ssh/config).

set -euo pipefail

REMOTE_HOST="ovh-dev"
REMOTE_DIR="/root/erp-api"
BRANCH="${1:-}"

echo "==> deploying to ${REMOTE_HOST}:${REMOTE_DIR}"

ssh -T "$REMOTE_HOST" bash -s -- "$REMOTE_DIR" "$BRANCH" <<'REMOTE_SCRIPT'
set -euo pipefail
REMOTE_DIR="$1"
BRANCH="$2"
cd "$REMOTE_DIR"

# node/pm2 aren't on PATH in a non-interactive ssh session (nvm + pnpm global
# bin are only wired up by ~/.bashrc, which ssh doesn't source) — load both
# explicitly, same as every command we ran by hand while debugging this box.
source ~/.nvm/nvm.sh
nvm use --silent v24.18.0
export PATH="$HOME/.local/share/pnpm/bin:$PATH"

# Git is the source of truth — any local edit on the server (hotfix, stray
# scp, whatever) gets discarded in favor of what's in the repo. `.env` is
# gitignored so it's never tracked and never touched by this reset/clean.
if [ -n "$(git status --porcelain)" ]; then
  echo "!! Discarding local changes on the server:"
  git status --short
  git reset --hard HEAD
  git clean -fd --exclude=.env --exclude=logs
fi
git fetch origin

if [ -n "$BRANCH" ]; then
  echo "==> git checkout $BRANCH"
  git checkout "$BRANCH"
fi

TARGET_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "==> resetting to origin/${TARGET_BRANCH}"
git reset --hard "origin/${TARGET_BRANCH}"
git clean -fd --exclude=.env --exclude=logs

echo "==> pnpm install"
pnpm install --frozen-lockfile

echo "==> build all BCs"
npm run build:all

# build:all only runs `nest build iam` — it does NOT run iam's esbuild asset
# step, so the admin-UI JS/CSS (apps/iam/dist/public) goes stale unless this
# runs separately. Skipping it 404s every view page's JS/CSS.
echo "==> build iam admin-UI assets"
npm run build:assets:iam

# pm2's `env_file` option is only read at `pm2 start` — `pm2 restart`/`reload`
# reuses whatever env the process last started with, so a changed .env
# silently keeps serving stale config. delete+start is the only way that's
# guaranteed correct, at the cost of a few seconds of downtime instead of a
# zero-downtime reload.
echo "==> restart pm2 (delete + start, so .env changes are always picked up)"
pm2 delete all || true
pm2 start ecosystem.config.js

pm2 list
REMOTE_SCRIPT

echo "==> health check"
ssh "$REMOTE_HOST" "curl -sS -o /dev/null -w 'iam dashboard: HTTP %{http_code}\n' http://127.0.0.1:3002/iam/v1/views/dashboard --max-time 10"

echo "==> done"
