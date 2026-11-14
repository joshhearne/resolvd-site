---
title: Time tracking
version: v0.11.0
order: 28
since: v0.11.0
summary: Per-ticket timers with auto-start and discard rules, work notes that stay private by default, work types, billable-hours rules, overlap and edit-lock integrity, weekly timesheets, approvals, CSV export, and hours per asset.
---

## What it is

Technicians run a timer while they work a ticket and log the time with a note describing what they did. Logged minutes are the time actually worked and never change; billing rules derive billable minutes from them on read.

Configured at **Admin → Time tracking** (Admin). Settings live in the `time_tracking_settings` singleton; list cards (work types, rate cards, bill types) save as you edit them, the rest through the page's save bar.

Who can use it: ticket handlers (global Admin / Manager / Tech, or a project handler override / Agent flag) on the ticket. The **Time** page in the left rail is shown to Admin / Manager / Tech.

---

## Timers

One timer per (user, ticket) in `ticket_timers`. On desktop the timer bar docks in the ticket header under **Follow**; on phones it renders inline. Controls: **Start timer**, **Pause**, **Resume**, log, discard.

- Starting a timer pauses any other timer you have running.
- A timer pauses on its own when the ticket enters a hold status (`awaiting_input`, `on_hold`), Resolved (`resolved_pending_close`), or a terminal status. Nothing auto-resumes — a reply on a held ticket doesn't restart the clock.
- Your running and paused timers are listed in the header's timer pill.

### Auto-start

| Setting | Default | Behavior |
|---|---|---|
| When a tech takes a ticket | on | Assigning a ticket to yourself starts your timer. |
| When a tech opens a ticket | off | Opening a ticket starts your timer. Pair with the discard rule. |

Auto-start only fires when the tech is solo on the ticket: it's unassigned or assigned to them, nobody else has a timer running on it, and the ticket isn't in a terminal status.

### Discard untouched timers

When a tech leaves a ticket without logging and the status hasn't changed since the timer started, the timer is thrown away.

| Option | Applies to |
|---|---|
| **Auto-started timers only** (default) | Timers a tech starts by hand are left alone. |
| **All timers** | Every timer. |
| **Never** | Timers keep running until paused, logged, or discarded. |

### Unlogged-time warning

`warn_after_minutes` (default 30, 0 = off, max 1440). When a running timer passes it with nothing logged, the timer turns amber and the tech gets one in-app notification.

---

## Logging time

The log form takes any two of **Start**, **Duration** and **Stop**; the third is derived (all three must agree within a minute). Minutes only means the entry ends now. Limits: whole minutes, at most 24 hours per entry, end no more than 5 minutes in the future.

- **Type** — work type picker, hidden when no types exist. Retired types still show on old entries.
- **Note** — required, at least `min_note_chars` characters (default 10, 1–500). The AI rewrite button works here when AI Assist is available to you.
- **Log & \<status\>** — logs the entry and moves the ticket to the chosen status in one step.

### Work note visibility

| Setting | Options |
|---|---|
| Default visibility | **Private note** (default) — saved as a handler-only note, never sent to the requester or vendors. **Public comment** — posted on the ticket thread; requester and followers are notified. |
| Who can choose | **Admins and Managers only** (default) — Techs always get the default. **Any handler** — Techs pick per entry. |

Deleting an entry whose note was a public comment leaves the comment on the thread. Visibility and billing are separate: a public note isn't automatically billable, and a private one isn't excluded from billing.

### Work types

Optional labels techs pick when logging (Remote, Onsite, Travel, Internal…), in `time_work_types`. In MSP mode each type has a **billable** flag that decides whether new entries of that type start billable, and rate cards can price types differently (see the billing doc).

---

## Billable hours

Shown under **Admin → Time tracking → Billable hours** when MSP mode is on (**Admin → Branding → Customer companies (MSP mode)**). Rules apply only to entries flagged billable.

| Setting | Values | Notes |
|---|---|---|
| New entries are billable by default | on / off (default off) | A work type's billable flag seeds new entries of that type. |
| Round each session to | 1 (none), 5, 6, 10, 15, 30 minutes | |
| Rounding | Up (default) / Nearest / Down | |
| Minimum per session | 0–480 minutes | Each billable entry counts as at least this much. |
| Minimum per ticket | 0–480 minutes; **Once per ticket** or **Once per day of work** | A ticket with any billable time bills at least this much. The difference is a separate *top-up* line. |
| Currency | 3-letter code (default `USD`) | Used on rates and exports. |
| Prepaid block alert | Warn at N % used (default 80, 0 = only when used up) | See the billing doc. |
| Approval | **Billable time needs Admin/Manager approval** | Approved time locks for techs; the export can be limited to approved time. |
| When these rules change | **Re-price all time not yet invoiced** (default) / **Keep each entry at the rules in force when it was logged** | The second stores the rules on each entry (`time_entries.billing_rules`); a ticket's minimum comes from the rules when its first billable time was logged. |

Order of operations, per ticket: each billable session is rounded, then raised to the session minimum; the ticket (or day) total is raised to the ticket minimum. A preview box on the card prices sample sessions with the current settings.

There's no invoicing yet. When it's added, invoiced time will be frozen at what it was billed.

---

## Timesheet integrity

| Setting | Values |
|---|---|
| Overlapping time | **Warn and ask to confirm** (default) / **Block it** / **Allow**. Checks the tech's other entries whose start–end intersects. |
| Timesheet lock | `edit_lock_days` (0–365, 0 = off). Once an entry ended more than N days ago, only Admin / Manager can change or delete it. |

---

## Timesheets and approvals

**Time → Timesheet** — a Monday-to-Sunday week of your entries by day, with weekly total, billable total and entry count. ‹ / › and a date picker move between weeks. Admin / Manager can pick another tech instead of *Me*.

**Time → Approvals** — Admin / Manager, MSP mode only. Billable, uninvoiced entries:

- **By ticket** (a ticket is reviewed and approved as a whole) or **By entry**.
- Filters: From / To, **Approval** (*Waiting for approval* / *Approved, not invoiced*), **Ticket** (*Resolved / closed* / *Still open* / *Any status*), **Tech**, **Customer**.
- Each row carries its priced line so the approver sees what they're signing off. **Approve** / **Un-approve** in bulk.

Per-ticket approval is also available from the ticket's time panel.

---

## Export

**Admin → Time tracking → Export time** (Admin / Manager): CSV of entries for a date range with logged and billable minutes under the current rules, ticket-minimum top-ups as their own rows. In MSP mode an *approved only* option limits it to approved time. Cells are quoted and a leading `= + - @` is neutralized so notes can't run as spreadsheet formulas.

---

## Hours per asset

**Inventory → asset → Time on this asset** totals time logged on tickets linked to the asset: last 30 days, last 90 days, all time, per tech, and by month for the last 12. Techs see tickets in projects they're members of; Admin / Manager see all, and in MSP mode the billed amount too. The asset's ticket list shows time per ticket.

---

## Endpoints

```
GET/PATCH         /api/time-tracking/settings              — PATCH Admin
GET               /api/time-tracking/timers/me
GET               /api/time-tracking/timesheet             — ?from= ?to= ?user_id=
GET/POST/PATCH/DELETE /api/time-tracking/work-types        — writes Admin
GET               /api/time-tracking/export                — Admin / Manager
GET/POST          /api/tickets/:id/time
PATCH/DELETE      /api/tickets/:id/time/:entryId
POST              /api/tickets/:id/timer/start | pause | discard | leave
POST              /api/tickets/:id/time/approval           — Admin / Manager
GET               /api/assets/:id/time
```
