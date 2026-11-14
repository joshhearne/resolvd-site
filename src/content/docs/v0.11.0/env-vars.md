---
title: Environment Variables
version: v0.11.0
order: 10
summary: Required and optional env vars for Postgres, sessions, OAuth credentials, and the published image tag + host updater.
---

Email backend (Graph / Gmail / SMTP) and SMTP credentials are configured at runtime in **Admin → Authentication → Email**, not via env. Same for Entra/Google enable toggles — env vars below only supply the credentials.

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_PASSWORD` | yes | — | Postgres password |
| `SESSION_SECRET` | yes | — | Random 32+ char string |
| `FRONTEND_URL` | yes | — | Public base URL |
| `COOKIE_SECURE` | yes | `true` | Set `true` behind HTTPS |
| `PORT` | no | `3001` | Backend port (internal) |
| `APP_INTERNAL_PORT` | no | — | Not used. It's still in `.env.example`, but `docker-compose.yml` binds `127.0.0.1:8090` directly. To use another port, set `ports: !override ["127.0.0.1:9090:80"]` on `nginx` in `docker-compose.override.yml` (Compose 2.24+; without `!override` the port is added beside 8090, not swapped) |
| `UPLOADS_DIR` | no | `/data/uploads` | In-container path |
| `MAX_UPLOAD_MB` | no | `50` | Per-attachment limit |
| `COMPOSE_PROJECT_NAME` | no | dir name | Pin volume prefix when renaming the install directory |
| `RESOLVD_IMAGE_TAG` | no | `stable` | Which published images `docker compose` runs: a release (`v0.11.0`), a dev build (`dev-<sha>`), or the floating `stable` / `dev`. Managed by the host updater when it's installed. See the updates doc. |
| `RESOLVD_UPDATER_TOKEN` | no | — | Shared secret between the host updater and the app (`/api/system-updates/policy` and `/report`). `deploy/install-updater.sh` generates it; re-running the installer keeps the existing value. |
| `AZURE_TENANT_ID` | opt | — | Entra tenant |
| `AZURE_CLIENT_ID` | opt | — | Entra app ID |
| `AZURE_CLIENT_SECRET` | opt | — | Entra client secret |
| `AZURE_REDIRECT_URI` | opt | — | Must match App Registration |
| `GOOGLE_CLIENT_ID` | opt | — | Google OAuth client |
| `GOOGLE_CLIENT_SECRET` | opt | — | Google OAuth secret |
| `MAIL_FROM` | opt | — | Sender address (Graph backend only) |
