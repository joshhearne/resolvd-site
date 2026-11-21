#!/usr/bin/env bash
# demo-up.sh — stand up the Resolvd demo from scratch in a Claude Code cloud
# session: clone the app beside this repo, build backend + frontend from
# source stamped as the coming tag, run on :8091, bootstrap the admin, apply
# the demo seed, and split What's new so the pop-up shows only this release.
#
#   APP_VERSION=v0.12.0 scripts/cloud/demo-up.sh                 # main (after the release PR merges)
#   DEMO_BRANCH=docs/v0.12.0-help APP_VERSION=v0.12.0 scripts/cloud/demo-up.sh   # Help preview
#   scripts/cloud/demo-up.sh --no-build
#
# Seed files live in this repo: scripts/demo/seed-demo.sql (guarded DO blocks,
# safe to re-apply) and scripts/demo/seed-demo-extras.mjs (uploads through the
# API). Everything else is generated per session. Re-running keeps the DB.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEMO_DIR="${DEMO_DIR:-$ROOT/../resolvd-demo}"
BRANCH="${DEMO_BRANCH:-main}"
PORT=8091
BUILD=true; [[ "${1:-}" == "--no-build" ]] && BUILD=false

"$ROOT/scripts/cloud/docker-up.sh"

if [[ ! -d "$DEMO_DIR/.git" ]]; then
  git clone -q --depth 50 -b "$BRANCH" https://github.com/joshhearne/resolvd "$DEMO_DIR"
fi
cd "$DEMO_DIR"
git fetch -q --depth 50 --tags origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
git checkout -q -B "$BRANCH" "origin/$BRANCH"
SHA="$(git rev-parse HEAD)"
PREV="$(git describe --tags --abbrev=0 HEAD 2>/dev/null || true)"
VERSION="${APP_VERSION:-$(git describe --tags --always)}"
echo "→ $BRANCH @ ${SHA:0:7}, stamped $VERSION (previous tag ${PREV:-none})"

if [[ ! -f .env ]]; then
  cp .env.example .env
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 16)|; s|^SESSION_SECRET=.*|SESSION_SECRET=$(openssl rand -hex 32)|; s|^RESOLVD_MASTER_KEY=.*|RESOLVD_MASTER_KEY=$(openssl rand -base64 32)|; s|^FRONTEND_URL=.*|FRONTEND_URL=http://localhost:$PORT|; s|^COOKIE_SECURE=.*|COOKIE_SECURE=false|" .env
  echo "COMPOSE_FILE=docker-compose.yml:docker-compose.build.yml:docker-compose.override.yml" >> .env
fi
# Publish nginx on :8091 only (docker-compose.override.yml is git-ignored in the app).
cat > docker-compose.override.yml <<YML
services:
  nginx:
    ports: !override
      - "127.0.0.1:$PORT:80"
YML

if $BUILD; then
  echo "→ building resolvd-backend:local + resolvd-frontend:local"
  "$ROOT/scripts/cloud/cloud-build.sh" backend resolvd-backend:local -q \
    --build-arg APP_VERSION="$VERSION" --build-arg APP_COMMIT="${SHA:0:7}" \
    --build-arg BUILT_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null
  "$ROOT/scripts/cloud/cloud-build.sh" frontend resolvd-frontend:local -q >/dev/null
fi
docker compose up -d --no-build --force-recreate >/dev/null
docker compose restart nginx >/dev/null   # stale upstream IPs otherwise (502)
for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:$PORT/auth/methods" 2>/dev/null | grep -q '"local":true' && break; sleep 2; done
curl -fsS "http://127.0.0.1:$PORT/auth/methods" | grep -q '"local":true' || { docker compose logs --tail=40 backend; exit 1; }

# Credentials in this repo's .env (the blog/help runner reads it). Password
# rule: 12+ chars with upper, lower and a digit.
cd "$ROOT"
if [[ ! -f .env ]] || ! grep -q '^DEMO_PASSWORD=' .env; then
  printf 'DEMO_EMAIL=admin@resolvd.demo\nDEMO_PASSWORD=Harbor%sKx7\n' "$(openssl rand -hex 6)" >> .env
  chmod 600 .env
fi
set -a; . ./.env; set +a
if curl -fsS "http://127.0.0.1:$PORT/auth/methods" | grep -q '"bootstrap":true'; then
  echo "→ bootstrap admin"
  curl -fsS -X POST "http://127.0.0.1:$PORT/auth/local/bootstrap" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\",\"displayName\":\"Demo Admin\"}" >/dev/null
fi

cd "$DEMO_DIR"
psql_() { docker compose exec -T postgres psql -U resolvd -d resolvd -v ON_ERROR_STOP=1 "$@"; }
SEED="$ROOT/scripts/demo/seed-demo.sql"
if [[ -f "$SEED" ]]; then
  echo "→ seed-demo.sql"
  psql_ -q -f - < "$SEED" 2>&1 | grep -vE "NOTICE|^$" || true
else
  echo "⚠ $SEED missing: the demo has an admin but no data. Add the seed to this repo."
fi
if [[ -f "$ROOT/scripts/demo/seed-demo-extras.mjs" ]]; then
  echo "→ seed-demo-extras.mjs"
  (cd "$ROOT" && DEMO_URL="http://localhost:$PORT" node scripts/demo/seed-demo-extras.mjs) || echo "⚠ seed-demo-extras.mjs failed"
fi

# What's new: split the single fresh-DB release so the pop-up leads with this one.
if [[ -n "$PREV" && "$(psql_ -tAc 'select count(*) from change_releases')" == "1" ]]; then
  IDS="$(comm -13 <(git ls-tree --name-only "$PREV" backend/changes/ | sort) <(git ls-tree --name-only HEAD backend/changes/ | sort) \
    | { grep -v README || true; } | sed 's|backend/changes/||; s|\.md$||' | sed "s/.*/'&'/" | paste -sd, -)"
  if [[ -n "$IDS" ]]; then
    psql_ -q <<SQL
BEGIN;
UPDATE change_releases SET version='$PREV', commit=NULL, deployed_at = deployed_at - INTERVAL '30 days';
INSERT INTO change_releases (version, commit) VALUES ('$VERSION', '${SHA:0:7}');
UPDATE change_entries SET release_id = currval(pg_get_serial_sequence('change_releases','id')) WHERE id IN ($IDS);
COMMIT;
SQL
    echo "→ What's new split: $(echo "$IDS" | tr ',' '\n' | wc -l) entries under $VERSION"
  fi
fi
psql_ -qc "UPDATE users SET whats_new_seen_release_id = NULL" >/dev/null
echo "✓ demo on http://localhost:$PORT ($VERSION). Credentials: $ROOT/.env"
