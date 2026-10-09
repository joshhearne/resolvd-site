---
title: Operations
version: v0.10.0
order: 30
summary: Common ops — updates, logs, password reset, wipe-and-restart.
---

## Update to a new release

```sh
cd resolvd
git pull
./scripts/build-with-version.sh
docker compose up -d
```

`build-with-version.sh` is a thin wrapper around `docker compose build` that stamps `APP_VERSION` / `APP_COMMIT` / `BUILT_AT` from `git describe --tags --always --dirty` + short SHA + UTC timestamp into the backend image. The values surface in **Admin → System health → Build info** and at `GET /api/version`.

If you skip the wrapper and run `docker compose build` directly, the Build info card will read `dev / unknown / unknown` — harmless but unhelpful for telling instances apart.

## Check the running version

```sh
curl http://localhost:8090/api/version
# {"version":"v0.8.0","commit":"abcdef0","built_at":"2026-05-19T03:32:19Z"}
```

Or from the UI: **Admin → System health → Build info** card with a manual **Check for updates** button that compares against `github.com/joshhearne/resolvd` releases/latest. Admin-triggered only — no background phone-home.

## View logs

```sh
docker compose logs -f backend
docker compose logs -f nginx
```

## Reset a forgotten admin password

```sh
docker exec -it resolvd-backend node scripts/reset-password.js <email>
```

## Wipe everything (start fresh)

```sh
docker compose down -v
rm -rf data/uploads/*
```
