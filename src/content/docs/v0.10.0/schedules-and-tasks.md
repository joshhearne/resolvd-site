---
title: Ticket schedules + personal tasks
version: v0.10.0
order: 24
since: v0.10.0
summary: Recurring ticket templates fired on a cron schedule with an audit ledger, and owner-scoped personal tasks with one-off or recurring due dates.
---

## Ticket schedules

`ticket_schedules`: a template plus a schedule. Presets (daily / weekly / monthly by day-of-month / monthly nth weekday / yearly) compile to cron internally; raw cron is the escape hatch. Timezone-aware via `cron-parser`. End condition: indefinite, after N fires, or until a date.

**Template fields:** project, title, description (both encrypted via `FIELD_MAP`), impact, urgency, optional assignee, optional requestor (`submitted_by` override), contacts, `follower_ids[]` (auto-added on every fire), `runbook_article_id` (starts a `ticket_runbook_runs` row on every fire).

**Fire path** materializes a real ticket: `internal_ref`, encrypted patch, contacts, deduped followers, SLA policy, blind index. Description `@mentions` are not dispatched on create (repeated fires would spam); comment mentions on the fired ticket work as usual.

`ticket_schedule_runs` records every fire (`ok` / `error` + message). The scheduler ticks every 60 s; a failure still advances `next_fire_at` so a broken template never busy-loops.

```
GET/POST/PATCH/DELETE  /api/ticket-schedules
POST                   /api/ticket-schedules/preview     — next N fire times
GET                    /api/ticket-schedules/:id/runs
```

Admin → **Schedules**. Bulk Entra import (pick users from the directory, add in one shot) ships alongside.

## Personal tasks

`tasks` + `task_completions`. Owner-scoped, no fanout, no SLA. Encrypted title + body. `recurrence_kind` in (`once`, `preset`, `cron`); presets compile to cron with the same helper the schedules use. Optional `ticket_id` (`ON DELETE SET NULL`) so a task created from a ticket page carries the source ref.

```
GET/POST/PATCH/DELETE  /api/tasks
POST                   /api/tasks/:id/complete      — records a completion, advances next_due_at
POST                   /api/tasks/:id/skip          — recurring only
POST                   /api/tasks/:id/reschedule    — postpones the current occurrence
```

**UI:** `/tasks` (pending / completed / cancelled chips, markdown viewer, edit modal with preset / cron / one-off picker, reschedule + skip). Sidebar **Tasks** entry. Dashboard **My tasks** card with Overdue / Due today / Tomorrow and an inline complete checkbox. Global **New** menu in the header creates a ticket or a task from anywhere.
