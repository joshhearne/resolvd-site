---
title: SLA — warnings, business hours, escalations
version: v0.10.0
order: 60
summary: Per-priority SLA targets with pre-breach warnings + business-hours clocks. Escalation chains on warning + breach. Auto-assignment by priority with three strategies. Vendor-vs-internal pause split + time-in-status reporting.
since: v0.7.0
---

The SLA tracker shipped in v0.6.0; this release expands it heavily.

## Policy fields

| Column | Notes |
|---|---|
| `priority` (1–5) + `project_id` | Scope. Project rows override org defaults. |
| `response_target_minutes` / `resolve_target_minutes` | First-response + full-resolve targets. |
| `warning_threshold_percent` (default 80, 0 disables) | Fires a `fanoutSlaWarning` event when this fraction of the window has elapsed. Separate matrix event from the breach itself so users can opt out independently. |
| `business_hours_id` (nullable) | Pins this policy to a business-hours schedule. NULL = clock runs 24/7. |

## Business hours

Separate `business_hours_policies` table (timezone + day mask 0–6 + start/end times + enabled flag, per-project or org default). Plugs into the SLA clock via the new `addBusinessMinutes()` helper.

Friday 4pm + 4hr response target with org-default Mon–Fri 9–5 CT lands Monday 12pm, not Saturday 8pm. Seeded Mon–Fri 9–5 Central; admin adds per-project overrides for customer-specific hours.

Pause semantics: once a clock is paused (status enters `awaiting_input` or `on_hold`), the pause counts as wall-clock — business hours don't apply during pauses.

## Escalation chains

`escalation_chain_steps` table, one row per step. Grouped in the UI by (priority, project, trigger); `step_order` drives execution order within a group.

Four triggers map to the four SLA milestones:

- `warning_response`
- `warning_resolve`
- `breach_response`
- `breach_resolve`

Four actions:

- `notify_user` (specific user)
- `notify_role` (all active users with role)
- `reassign_user` (specific user, fires `fanoutAssignment` after the swap)
- `reassign_role` (lowest user-id with role; refine in a later release if real usage demands round-robin)

Each step has a `delay_minutes` grace period after the trigger before it fires. Project-scoped steps run **additively** alongside org defaults — a per-project nudge can coexist with an org-wide "page the on-call". Each step fires once per ticket via `tickets.escalation_steps_fired`.

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

## Time-in-status

`GET /api/sla/time-in-status?since=&until=&project_id=` aggregates per-status durations from `audit_log` `status_change` rows using `LEAD` window functions. Surfaced on the dashboard with a 7/30/90 day window picker.

Initial status (before any change) intentionally not counted — keeps the SQL simple. Most "stuck in Open" cases are visible from the live ticket list anyway.

## Notification semantics

Breach + warning fanouts bypass the digest cadence — both are action-required signals that need to land while there's still time to act. In-app notification + immediate email per recipient (assignee + ticket followers + submitter, deduped).
