---
title: Inbound Email Routing
version: v0.10.0
order: 35
since: v0.8.0
summary: Routing precedence, agent-forward attribution, and the default landing project for multi-scope inboxes.
---

## Routing precedence

When an inbound email lands on a Resolvd-managed inbox, the inbound processor walks this precedence list:

1. **`#PREFIX` token in the subject line** → project lookup by prefix. Matches `^#([A-Za-z][A-Za-z0-9]+)` at the start of the subject.
2. **Single-scope inbox** → if the receiving inbox is scoped to exactly one approved + recv-enabled project, route there even without a prefix. (Helpdesk pattern.)
3. **Multi-scope inbox with pinned default** (v0.8.0) → if the inbox is scoped to multiple projects and an Admin has pinned `default_inbound_project_id`, route there.
4. **Manual queue** → otherwise drops into **Admin → Inbound queue** for review.

## Default landing project (multi-scope inboxes)

For inboxes that serve multiple projects, set the fallback under **Admin → Email backends → {account} → Project scope → Default landing project**. Only Admins can change this.

Constraints:

- The default must be one of the account's approved + recv-enabled scopes. The PUT endpoint rejects anything else with `400`.
- The picker only renders when there are 2+ eligible scopes. Single-scope inboxes already auto-route via rule 2 above.
- Setting `null` clears the default and reverts to manual-queue fallback.
- If you remove the scope that the default points at, the lookup degrades to "no route" gracefully (no orphaned routing).

## Agent-forwarded submissions

When an internal agent forwards an external email into a Resolvd inbox, v0.8.0 unwraps the forwarded payload and attributes the ticket to the **original sender**, not the forwarding agent.

**Detection:** body contains one of the standard forward markers:

- `Begin forwarded message:` (Apple Mail)
- `Forwarded message` with leading dashes (Gmail)
- `-----Original Message-----` (Outlook)

…followed by a `From:` line within the next ~25 lines. The inner email address is extracted as the original sender.

**Attribution rules:**

- Outer `From:` must match an active Resolvd user (the forwarding agent). Prevents external senders from spoofing a "forwarded" payload to impersonate someone.
- Inner `From:` must match an active internal user authorized to submit. External / contact senders are a follow-up — for v0.8.0, unknown inner senders fall back to the existing flow (agent becomes submitter).
- When both match: `submitted_by = inner sender`, `assigned_to = forwarding agent`.

**Audit:** the create row reads `Created via forward from <agent.email> on behalf of <submitter.email>`. A second `assigned` audit row records the auto-assign.

**`#PREFIX` still routes.** The agent prepends `#PREFIX` to the **outer** subject (the one their mail client sets when they hit Forward). Inner subject is ignored for routing; it's just the title text the original sender wrote.

## Auto-resume from awaiting_input

When an inbound reply lands on a ticket sitting in a status with `semantic_tag = 'awaiting_input'`, the processor auto-transitions it to the project's `in_progress` status. Audited as `status_change_auto` with note `Auto-resumed: inbound reply received while awaiting input`.

Triggers on both flows:

- Matched inbound replies (tryAutoReply) — automatic.
- Manual-queue admin match — auto-resume fires when the reviewer attaches the email to an awaiting_input ticket.

No gratitude filter (unlike the resolved-grace path): any reply on an awaiting_input ticket is signal that whatever you were waiting for has arrived.
