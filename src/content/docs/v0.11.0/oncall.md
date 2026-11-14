---
title: On-call rotations
version: v0.11.0
order: 62
since: v0.11.0
summary: Rotations with members, shift length and a handoff anchor; overrides for swaps and leave; how Notify on-call / Reassign to on-call escalation steps pick the person.
---

## What it is

On-call rotations answer "who's on call for this ticket right now?" for SLA escalation steps. Configured at **Admin → On-call rotations** (Admin / Manager). Rotations don't page anyone on their own; an escalation step does (see the SLA doc).

---

## Rotations

| Field | Notes |
|---|---|
| Name | e.g. *Infra primary*. |
| Scope | One project, or **Org-wide (any project without its own rotation)**. |
| Shift length (hours) | 1–8760. Default 168 (one week). |
| First handoff | The moment member 1's shift starts, entered in your local time. |
| Members, in rotation order | Reorder with move up / down. No repeats. |
| Enabled | Disabled rotations are ignored. |

Members take turns, one shift each, cycling from the first handoff forward (and backward before it). Who is on call at any instant is arithmetic over the handoff and shift length; there are no per-shift rows to maintain. Each rotation card shows **On call now** and the **Upcoming shifts** (overrides are listed separately, not folded into that list).

---

## Overrides

**Overrides → Add override** puts a specific user on call for a window (swaps, cover for leave): who covers, start, end, optional note. An override beats the rotation for its window; where overrides overlap, the newest wins. Overrides that ended more than a day ago drop out of the list.

---

## How escalations pick the person

Escalation steps use two actions:

| Action (UI) | Kind | Behavior |
|---|---|---|
| **Notify on-call** | `notify_oncall` | Notifies the current on-call person of every matching rotation. |
| **Reassign to on-call** | `reassign_oncall` | Assigns the ticket to the on-call person of the first matching rotation (lowest id). |

Matching rotations for a ticket:

1. The rotation pinned on the step (`rotation_id`), if set and enabled; otherwise
2. the ticket's project's enabled rotations; otherwise
3. the org-wide enabled rotations.

A project's own rotations replace the org-wide ones for its tickets. With several rotations in one scope (primary and secondary), notify reaches everyone on call and reassign takes the first. Users who are no longer active are skipped. A step with nobody on call waits and retries on later scheduler ticks until someone is.

Rotations have no business-hours setting: who is on call depends only on the rotation and its overrides. The escalation step's delay still follows the SLA policy's business hours when one is pinned (see the SLA doc).

---

## Endpoints

```
GET    /api/oncall                           — rotations, overrides, on call now, upcoming shifts
POST   /api/oncall
PATCH  /api/oncall/:id
DELETE /api/oncall/:id
POST   /api/oncall/:id/overrides
DELETE /api/oncall/:id/overrides/:overrideId
```

All Admin / Manager.
