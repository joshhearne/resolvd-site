---
title: SLA — warnings, business hours, escalations
version: v0.11.0
order: 60
summary: Per-priority SLA targets with pre-breach warnings + business-hours clocks, holidays and per-location hours. Escalation chains (including on-call) on warning + breach. Breach webhooks to Slack / Teams / PagerDuty / generic. Auto-assignment by priority. Vendor-vs-internal pause split, actionable SLA card, time-in-status reporting.
since: v0.7.0
---

The SLA tracker shipped in v0.6.0; this release expands it heavily.

## Policy fields

| Column | Notes |
|---|---|
| `priority` (1–5) + `project_id` | Scope. Project rows override org defaults. |
| `response_target_minutes` / `resolve_target_minutes` | First-response + full-resolve targets. |
| `warning_threshold_percent` (default 80, 0 disables) | Fires a `fanoutSlaWarning` event when this fraction of the window has elapsed. Separate matrix event from the breach itself so users can opt out independently. |
| `business_hours_id` (nullable) | Pins this policy to a business-hours schedule. NULL = clock runs 24/7. A location's own hours replace the pinned window (since v0.11.0; see below). |

## Business hours

Separate `business_hours_policies` table (timezone + day mask 0–6 + start/end times + enabled flag, per-project or org default). Plugs into the SLA clock via the new `addBusinessMinutes()` helper.

Friday 4pm + 4hr response target with org-default Mon–Fri 9–5 CT lands Monday 12pm, not Saturday 8pm. Seeded Mon–Fri 9–5 Central; admin adds per-project overrides for customer-specific hours.

Pause semantics: once a clock is paused (status enters `awaiting_input` or `on_hold`), the pause counts as wall-clock — business hours don't apply during pauses.

### Per-location hours (since v0.11.0)

A business-hours policy can be scoped to a **location** instead of a project (**Admin → SLA policies → Business hours → + Add policy → Location**). For a ticket at that location, the location's enabled window replaces the SLA policy's pinned window. A 24/7 SLA policy (no `business_hours_id`) stays 24/7 regardless of location.

`tickets.location_id` is stamped on create from the submitter's company membership (`company_members.location_id`) and is editable on the ticket. Escalation delays follow the same per-location window.

### Holidays (since v0.11.0)

Each business-hours policy carries a holiday list, shown in the policy's timezone. The SLA clock and escalation delays skip a holiday like a weekend; billing prices it at the weekend multiplier (see the billing doc). No holidays are seeded.

| Rule | Example |
|---|---|
| **On a date** | `2026-06-08`, or every year on the same month/day (*Every December 25*). A recurring Feb 29 only lands in leap years. |
| **Weekday rule** | *4th Thursday of November*, *last Monday of May*. A 5th weekday that doesn't exist in a month is skipped that year. |

Options on either kind:

- **Observed** — a holiday on Saturday is taken the Friday before; one on Sunday, the Monday after.
- **Length → Days** (`span_days`, 1–14) — closed that many consecutive days from the date it's taken. Thanksgiving Thursday + Friday = *4th Thursday of November · 2 days*.
- **Length → Early close** (`closes_at`, `HH:MM`) — open as usual until that local time, closed after. Single-day only.

Where rules overlap, a whole-day closure beats an early close, and the earlier close wins.

**Holiday calendar feed.** Any active user can subscribe to a policy's holidays from **Account settings → Calendar** (`GET /api/calendar/feed/:token/holidays/:id.ics`). The token in the URL is the credential; regenerating it revokes old links.

## Escalation chains

`escalation_chain_steps` table, one row per step. Grouped in the UI by (priority, project, trigger); `step_order` drives execution order within a group.

Four triggers map to the four SLA milestones:

- `warning_response`
- `warning_resolve`
- `breach_response`
- `breach_resolve`

Each step carries an `actions[]` array, so one (trigger, delay) can fan out to several targets:

- `notify_user` (specific user)
- `notify_role` (all active users with role)
- `notify_assignee` (current assignee, NULL-safe)
- `notify_oncall` (since v0.11.0) — whoever is on call now for the ticket's project; each matching rotation's person. Optional `rotation_id` pins one rotation.
- `reassign_user` (specific user, fires `fanoutAssignment` after the swap)
- `reassign_role` (first active user with role)
- `reassign_oncall` (since v0.11.0) — the on-call person of the first matching rotation
- `reassign_agent` — defer to the project's assignment policy (round robin / case load), excluding the current assignee
- `bump_priority` — raise urgency by `levels`, never past `floor`

In the UI these are **Notify on-call** / **Reassign to on-call**. A step with nobody on call waits and retries until someone is. Rotations are covered in the on-call doc.

Each step has a `delay_minutes` grace period after the trigger before it fires. When the matching SLA policy pins business hours, the delay is walked through business minutes (location hours and holidays included), so a 30-minute step after a 4:55 PM breach doesn't fire at 5:25 PM. Project-scoped steps run **additively** alongside org defaults — a per-project nudge can coexist with an org-wide "page the on-call". Each step fires once per ticket via `tickets.escalation_steps_fired`.

## Priority operators

Both escalation and assignment policies accept `priority_op` ∈ `=`, `<`, `<=`, `>`, `>=`. Read the operator as a **severity comparison** — `>=` means "at least as urgent as":

| Row | Matches |
|---|---|
| `=` 2 | P2 only |
| `>= 2` | P1, P2 (more urgent or equal to P2) |
| `>` 2 | P1 (strictly more urgent than P2) |
| `<= 2` | P2, P3, P4, P5 (less urgent or equal to P2) |
| `<` 2 | P3, P4, P5 (strictly less urgent than P2) |

In SQL terms the comparison flips because P1 = priority value 1 = highest severity. `priority_op = '>='` evaluates as `ticket.effective_priority <= row.priority` — so the wording in the table above is what the doc author + UI surface, not the raw integer math.

Resolution precedence when multiple rows match:

1. Project-scoped row beats org default.
2. Exact `=` beats range operators.
3. Newest beats older (`created_at DESC`).

## Auto-assignment

`assignment_policies` table picks an agent at ticket create time. Three strategies:

| Strategy | Behavior |
|---|---|
| `round_robin` | Cycle through `agent_pool` in order. Cursor advances atomically via `UPDATE…RETURNING` so concurrent inserts don't double-pick. |
| `case_load` | Among the pool, pick whoever has fewest open tickets right now. Ties break by user_id ASC. |
| `specific_user` | Always assign to `specific_user_id`. |

Order of precedence at ticket create:

1. Explicit `assigned_to` from the request wins.
2. Otherwise, assignment policy resolves and picks.
3. Otherwise, project's `default_assignee_id` fills in.

## Agent flag

Per-project member flag (`project_members.is_agent`). Replaces the old role-based filter on the assignment / escalation user pickers. A Tech can be an Agent on Project A but not Project B without role changes.

For org-default policies (no project scope), the picker shows users who are Agent on **at least one** project. For project-scoped policies, the picker is filtered to that project's agents.

## Vendor-vs-internal pause split

Tickets pause when entering an `awaiting_input` or `on_hold` semantic tag. Until v0.7.0 the total was lumped into `sla_paused_seconds`. Now it splits:

- `sla_vendor_wait_seconds` — `awaiting_input` (external party blocking).
- `sla_internal_hold_seconds` — `on_hold` (we blocked ourselves).

Dashboard SLA card renders a stacked bar. Answers "are we slow or is our vendor slow?" at a glance.

## Dashboard SLA card (since v0.11.0)

- **Pause time** counts only open tickets paused right now (vendor / internal), not the lifetime accumulators — finished waits and stale pauses on Closed tickets no longer inflate it.
- The month-to-date breaches-by-project grid is replaced by lists that name the ticket and who has it:
  - **Breached now** — most overdue first.
  - **Due soon**.
  - **Paused right now** — vendor / internal, longest first.
  - **Late this month** — each breached clock and how late.
- Breached and at-risk lists exclude Closed and resolved tickets. Project totals remain as chips.
- Submitters get `403` from the SLA dashboard and time-in-status endpoints.

## Time-in-status

`GET /api/sla/time-in-status?since=&until=&project_id=` aggregates per-status durations from `audit_log` `status_change` rows using `LEAD` window functions. Surfaced on the dashboard with a 7/30/90 day window picker.

Initial status (before any change) intentionally not counted — keeps the SQL simple. Most "stuck in Open" cases are visible from the live ticket list anyway.

## Notification semantics

Breach + warning fanouts bypass the digest cadence — both are action-required signals that need to land while there's still time to act. In-app notification + immediate email per recipient (assignee + ticket followers + submitter, deduped).

## Breach webhooks (since v0.11.0)

**Admin → SLA policies → Breach notifications → + Add webhook.** Fired alongside the in-app / email fanout.

| Kind | Destination | Message |
|---|---|---|
| `slack` | Incoming-webhook URL | Block Kit |
| `teams` | Teams Workflows URL (*When a Teams webhook request is received*) | Adaptive Card |
| `pagerduty` | Events API v2 routing key | One incident per ticket + clock (`dedup_key`), auto-resolved once the ticket is resolved or closed |
| `generic` | Any URL | JSON; signed with HMAC-SHA256 over `timestamp.body` in `X-Resolvd-Signature` when a secret is set |

Per webhook:

- **Events** — any of `breach_response`, `breach_resolve` (default), `warning_response`, `warning_resolve`.
- **Project** — one project, or *All projects*.
- **Priorities** — `max_priority` N fires for P1..PN (*P1 only* … *All (P1–P5)*).
- **Enabled**, plus last-sent status and a delivery log.

URLs, routing keys and signing secrets are stored encrypted and never returned to the browser (the list shows a masked hint). They need the master key (**Admin → Encryption**). PagerDuty severity maps from priority: P1 `critical`, P2 `error`, P3 `warning`, else `info`; warnings always send `warning`.
