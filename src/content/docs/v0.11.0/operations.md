---
title: Operations
version: v0.11.0
order: 30
summary: Common ops — published images, updating by hand or with the host updater, building from source, logs, wipe-and-restart.
---

## Published images

From v0.11.0, `docker compose up` pulls prebuilt images instead of building on the server:

```
ghcr.io/joshhearne/resolvd-backend:${RESOLVD_IMAGE_TAG:-stable}
ghcr.io/joshhearne/resolvd-frontend:${RESOLVD_IMAGE_TAG:-stable}
```

`.github/workflows/images.yml` publishes them:

| Trigger | Tags |
|---|---|
| Release tag `vX.Y.Z` | `:vX.Y.Z` + floating `:stable` |
| Pre-release tag `vX.Y.Z-rc.N` | `:vX.Y.Z-rc.N` only (`:stable` doesn't move) |
| Push to `dev` | `:dev-<sha7>` + floating `:dev` |

`RESOLVD_IMAGE_TAG` in `.env` picks the build. Leave it unset to run the latest release.

## Update to a new release (by hand)

Without the host updater, or on the **Manual** channel, check out the release and pull its images. Schema changes apply automatically when the backend starts.

```sh
cd resolvd
git fetch --tags && git checkout v0.11.0
sed -i 's/^RESOLVD_IMAGE_TAG=.*/RESOLVD_IMAGE_TAG=v0.11.0/' .env   # add the line if it's missing
docker compose pull && docker compose up -d
```

## Automatic updates (host updater)

```sh
sudo deploy/install-updater.sh             # runs as the checkout's owner
sudo deploy/install-updater.sh --user ops  # or another user in the docker group
```

The installer checks that the images for `RESOLVD_IMAGE_TAG` can be pulled and changes nothing if they can't. Then it generates `RESOLVD_UPDATER_TOKEN` in `.env`, starts the stack on those images, and enables `resolvd-update.timer`. Re-running is safe.

`deploy/resolvd-update.sh` runs every 10 minutes on the host, outside the containers. The app never gets Docker access. At the admin's update hour, or on **Update now**, it:

1. Skips the target unless it's newer than what's running. It never moves to an older build.
2. Backs up the database to `backups/pre-update-*.sql.gz` (keeps the last 7).
3. Checks out the target commit, sets `RESOLVD_IMAGE_TAG`, restarts the stack.
4. Waits up to 3 minutes for `/api/version` to report the new commit. Otherwise it rolls back to the previous commit and images and skips that build until a newer one appears or an admin presses **Update now**.

Channels, the update hour, history and the What's new pop-up are covered in the updates doc.

```sh
journalctl -u resolvd-update.service         # updater logs
systemctl list-timers resolvd-update.timer   # next run
sudo systemctl disable --now resolvd-update.timer   # remove
```

Auto-updates expect a git checkout with no local edits to tracked files. Put local overrides in `.env` or `docker-compose.override.yml`.

## Build from source

```sh
./scripts/build-with-version.sh            # or: ./scripts/build-with-version.sh backend
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d
```

`build-with-version.sh` runs `docker compose -f docker-compose.yml -f docker-compose.build.yml build` and stamps `APP_VERSION` / `APP_COMMIT` / `BUILT_AT` from `git describe --tags --always --dirty` + short SHA + UTC timestamp into the backend image. Source builds are tagged `resolvd-*:local` so they never collide with the published images. Don't combine them with the host updater.

## Running on a VPS

The repo README has a step-by-step guide: any Linux VPS with 2 GB RAM or more, Docker via `get.docker.com`, `.env` with `POSTGRES_PASSWORD` / `SESSION_SECRET` / `FRONTEND_URL` / `COOKIE_SECURE` / `RESOLVD_MASTER_KEY`, then HTTPS in front with Caddy, a Cloudflare Tunnel, or host nginx, and `ufw` for 80/443 + SSH. The stack only listens on `127.0.0.1:8090`.

The proxy must **set** the client-IP headers rather than pass the visitor's values through (login security blocks by IP). See Troubleshooting → *Every login attempt shows the same IP*.

## Check the running version

```sh
curl http://localhost:8090/api/version
# {"version":"v0.11.0","commit":"abcdef0","built_at":"2026-11-14T03:32:19Z"}
```

Or from the UI: **Admin → System health → Build info**. The old **Check for updates** button is gone; the **Updates** panel on the same page shows what's running vs. available.

## View logs

```sh
docker compose logs -f backend
docker compose logs -f nginx
```

## Wipe everything (start fresh)

```sh
docker compose down -v
rm -rf data/uploads/*
```
