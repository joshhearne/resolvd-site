---
title: Environment Variables
version: v0.10.0
order: 10
summary: Required and optional env vars for Postgres, sessions, and OAuth credentials.
---

Email backend (Graph / Gmail / SMTP) and SMTP credentials are configured at runtime in **Admin → Authentication → Email**, not via env. Same for Entra/Google enable toggles — env vars below only supply the credentials.

| Variable | Required | Default | Description |
|---|---|---|---|
| `POSTGRES_PASSWORD` | yes | — | Postgres password |
| `SESSION_SECRET` | yes | — | Random 32+ char string |
| `FRONTEND_URL` | yes | — | Public base URL |
| `COOKIE_SECURE` | yes | `true` | Set `true` behind HTTPS |
| `PORT` | no | `3001` | Backend port (internal) |
| `APP_INTERNAL_PORT` | no | `8090` | Bound on `127.0.0.1` |
| `UPLOADS_DIR` | no | `/data/uploads` | In-container path |
| `MAX_UPLOAD_MB` | no | `50` | Per-attachment limit |
| `COMPOSE_PROJECT_NAME` | no | dir name | Pin volume prefix when renaming the install directory |
| `AZURE_TENANT_ID` | opt | — | Entra tenant |
| `AZURE_CLIENT_ID` | opt | — | Entra app ID |
| `AZURE_CLIENT_SECRET` | opt | — | Entra client secret |
| `AZURE_REDIRECT_URI` | opt | — | Must match App Registration |
| `GOOGLE_CLIENT_ID` | opt | — | Google OAuth client |
| `GOOGLE_CLIENT_SECRET` | opt | — | Google OAuth secret |
| `MAIL_FROM` | opt | — | Sender address (Graph backend only) |
