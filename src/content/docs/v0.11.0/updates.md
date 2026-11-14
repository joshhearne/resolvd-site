---
title: Updates + What's new
version: v0.11.0
order: 32
since: v0.11.0
summary: Update channels (Production / Development / Manual), update hour, Update now, host updater check-ins and history, the What's new pop-up and backend/changes files, and the admin preview of the next build.
---

## How it fits together

Docker installs can update themselves overnight. Two pieces:

| Piece | Role |
|---|---|
| **Admin → System health → Updates** (Admin) | Stores the channel and update hour, shows what's running vs. available, the host's last check-in, recent updates and rollbacks, and a preview of the next build's changes. |
| Host updater (`deploy/resolvd-update.sh`, systemd timer every 10 minutes) | Polls the policy, does the update on the host, reports back. |

The containers never get Docker access. The host authenticates to `/api/system-updates/policy` and `/report` with `RESOLVD_UPDATER_TOKEN`; without it those endpoints answer `503`. Installing the updater and what each run does are covered in the operations doc.

---

## Channels

| Channel | Gets | Use for |
|---|---|---|
| **Production** | Each new release (`vX.Y.Z` tag on `main`) at the update hour | Live servers |
| **Development** | The latest `dev` build, nightly | Test / staging servers |
| **Manual** (default) | Nothing automatically; the panel shows what's available and the commands to run | Admins who update by hand |

- **Update hour** — 00:00–23:00, server time (default 03:00). Shown for Production and Development. A short restart happens during the update.
- **Update now** — asks the host to update at its next check (within 10 minutes) instead of waiting for the update hour. Not available on Manual. It also retries a build that was skipped after a failed health check.
- Servers only move forward. Switching from Development to Production waits until a release includes the dev build the server is running.

---

## Panel states

| Message | Meaning |
|---|---|
| *The host updater isn't installed* | `RESOLVD_UPDATER_TOKEN` isn't set for the app. Run `sudo deploy/install-updater.sh` from the Resolvd folder. |
| *The host updater hasn't checked in yet* | Installed, waiting for the first run. Check `systemctl list-timers resolvd-update.timer`. |
| *Last checked in …* | Shown when the last check-in is more than 30 minutes old. Check `journalctl -u resolvd-update.service`. |

The host's last report shows with its message: `up_to_date`, `waiting`, `manual`, `updated`, `rolled_back` or `failed`. **Recent updates** lists the last 10 updates, rollbacks and failures with from → to versions. Routine "nothing new" checks only refresh the last report.

---

## What's new

After an update, people get a **What's new: \<version\>** pop-up (`vX.Y.Z` on Production, `dev-<commit>` on Development) after sign-in, plus a *Resolvd was updated* entry in the notification bell that reopens it.

- Changes are listed as new features (blue), improvements (green) and fixes (orange).
- Admin / Manager / Tech see every change. Submitters and Viewers see only entries marked for everyone, and get nothing when an update has none.
- A rollback boots an older image without the newest entries; those entries are dropped again, with their pop-up and bell notifications.

### Preview the next build

When the host reports an available build, the Updates panel shows **Coming in \<version\> · N changes** with the same list. Only Admins see this preview; everyone sees the changes that concern them after the update installs.

---

## Change files

Every user-visible change ships as a small Markdown file in `backend/changes/`. The files travel inside the backend image; on boot the running build compares them with what the database has already seen, and anything new becomes a release. The host updater sends the files the target build adds, which feeds the preview.

```markdown
---
type: feature        # feature | improvement | fix
audience: everyone   # everyone | staff (default: staff)
---
Holidays can span several days, or close early.
```

- **type** sets the bullet color.
- **audience** — `staff` entries are shown to Admins, Managers and Techs only. Use `everyone` only when Submitters and Viewers will notice the change.
- **Body** — one short sentence for the people using Resolvd. Markdown works; a `- ` list gives several bullets.
- **File name** — anything unique (`holiday-ranges.md`). It's the entry's id: don't rename a file after it has shipped. Fixing the wording is fine; running installs pick it up.
- Dependency bumps, refactors and CI changes don't need a file.

---

## Endpoints

```
GET    /api/system-updates                   — Admin: policy, last report, history, pending changes
PUT    /api/system-updates                   — Admin: { channel?, update_hour? }
POST   /api/system-updates/update-now        — Admin; 409 on Manual
GET    /api/system-updates/policy            — host (RESOLVD_UPDATER_TOKEN)
POST   /api/system-updates/report            — host (RESOLVD_UPDATER_TOKEN)
GET    /api/whats-new                        — releases you may see
GET    /api/whats-new/unseen
POST   /api/whats-new/seen
GET    /api/whats-new/:id
```
