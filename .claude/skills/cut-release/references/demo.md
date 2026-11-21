# Demo (cloud)

`scripts/cloud/demo-up.sh` (this repo) does it all, idempotently; re-running keeps the database:

1. Starts dockerd (`docker-up.sh`).
2. Clones `joshhearne/resolvd` to `../resolvd-demo` on `DEMO_BRANCH` (default `main`).
3. Writes the app `.env` (random secrets, `FRONTEND_URL=http://localhost:8091`, `COOKIE_SECURE=false`, `COMPOSE_FILE=docker-compose.yml:docker-compose.build.yml:docker-compose.override.yml`) and an override that publishes nginx on `127.0.0.1:8091` only.
4. Builds `resolvd-backend:local` / `resolvd-frontend:local` with `cloud-build.sh`, stamped `APP_VERSION` (What's new and Build info show it). `--no-build` skips.
5. Starts the stack, restarts nginx (502s on stale IPs otherwise).
6. Writes `DEMO_EMAIL` / `DEMO_PASSWORD` into this repo's `.env` and bootstraps the admin via `POST /auth/local/bootstrap` (routes are `/auth/*`, not `/api/auth/*`).
7. Applies `scripts/demo/seed-demo.sql`, then runs `scripts/demo/seed-demo-extras.mjs` if present.
8. Splits What's new (entries new since the previous tag under `APP_VERSION`, the rest under the previous tag, backdated) and resets every user's seen marker.

For a full wipe: `cd ../resolvd-demo && docker compose down -v`, then run demo-up again.

## Seeding a new release

Append a guarded block per release to `scripts/demo/seed-demo.sql`, so re-applying is a no-op:

```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM <table new this release>) THEN RAISE NOTICE 'skip'; RETURN; END IF;
  ...
END $$;
```

Apply to the running demo: `cd ../resolvd-demo && docker compose exec -T postgres psql -U resolvd -d resolvd -f - < ../resolvd-site/scripts/demo/seed-demo.sql`.

Rules:
- Fictional customer **Acme Corp** (John Doe, Jane Roe; `@acme-demo.test`). This repo is public: fictional data only.
- Dates relative to `NOW()`, never fixed.
- Make numbers cross thresholds on purpose (a prepaid block at 84% so the 80% alert fires).
- Picker names come from `project_members.is_agent = TRUE`; seed members or UIs show "User #N".
- Integration sources with `capabilities = '{alerts}'` are never polled, so seeded monitor states stay put.
- Watch unique indexes (location business hours need `project_id` NULL).
- Uploads go through the API (encrypted at rest): extend `seed-demo-extras.mjs` (reads `DEMO_URL`, `DEMO_EMAIL`, `DEMO_PASSWORD`).
- Revoke anything a screenshot could leak (e.g. delete the admin's `calendar_feeds` row).
- Resolvd's KB integration reads collections from a Trove KB demo through an API key. In the cloud, run the Trove demo in the same session (`trove-kb-com/scripts/cloud/demo-up.sh`, :3081) and reach it from the Resolvd backend container over a shared Docker network (`docker network connect resolvd_internal trove-kb-demo-app-1`, then `http://trove-kb-demo-app-1:3000`). Not yet tried in the cloud: verify, or skip KB shots for that release.

## What's new by hand

If the split needs redoing (e.g. after adding change files):

```sql
BEGIN;
UPDATE change_releases SET version='<prev tag>', commit=NULL, deployed_at = deployed_at - INTERVAL '30 days' WHERE id = 1;
INSERT INTO change_releases (version, commit) VALUES ('<tag>', '<main sha>');
UPDATE change_entries SET release_id = currval(pg_get_serial_sequence('change_releases','id')) WHERE id IN (<change-file names>);
UPDATE users SET whats_new_seen_release_id = NULL;
COMMIT;
```

Entry wording updates in place on each deploy (matched by filename).
