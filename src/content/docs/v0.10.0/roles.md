---
title: User Roles
version: v0.10.0
order: 20
summary: Admin / Manager / Tech / Submitter / Viewer — what each can do, plus per-project overrides.
---

## Admin

Full access. Manage users, projects, branding, auth, statuses, SLA + assignment + escalation policies, custom fields, asset types, integrations.

## Manager

Manage tickets in assigned projects. Assign work, change status, edit asset cross-refs, delete assets. Cannot manage users / branding / auth / system config.

## Tech

Since: v0.7.0. Internal IT staff who handle tickets day-to-day without admin-level access. Can:

- Create + edit tickets (title / description / status / priority override / assignee / asset link / blocker / contacts / follow-ups / vendor notifications).
- Comment, manage followers, upload attachments.
- Post **handler-only notes** on tickets — see the Notes section below.
- Run **runbooks** on tickets — see the runbooks doc (since v0.9.0).
- Mark comments **vendor-visible** (since v0.9.0 — previously Admin/Manager only; aligned with the notes ACL).
- Browse the **Inventory** module — assets, custody log, asset tags, label printer (since v0.9.0 made it handler-only).
- Manage **Consumables** — add/edit parts, adjust stock with audit-logged movements, print labels (since v0.9.0).
- Create + edit + archive **Knowledge Base** articles in projects they're a member of, including agent-only articles + runbooks. Cannot **delete** an agent-only article — that's Admin only.
- Create + edit manual assets (printers, deskphones, NVRs). Edit cross-refs (linked user, company, asset type) on RMM-managed assets.
- Edit custom field values on assets.

Tech cannot delete tickets/assets, delete agent-only KB articles, run bulk ticket ops, define custom field schemas, manage SLA / AI / branding / users / projects.

## Submitter

Open tickets, comment, attach files. Cannot reassign.

Submitter accounts can be **auto-provisioned** (since v0.9.0) when an unknown email arrives via inbound email or an alert integration. Admins get a notification pointing at `/admin/users` so they can flesh out the row; SSO works immediately when Entra is configured (Graph `/users/{email}` populates `display_name`, `entra_oid`, `upn`). Vendor-domain senders are decline-listed against `companies.kind = 'vendor'` and continue to land as contacts.

## Viewer

Read-only. Useful for stakeholders and exec dashboards. Inventory and the bulk-assignee picker are no longer reachable for Viewers (since v0.9.0).

## Support

JIT-grant role for vendor support agents. Locked out of `/api/*` except `/api/support/*` until an Admin grants temporary access.

---

Roles can be overridden per project. Valid project-level overrides (v0.8.0):
**Admin, Manager, Tech, Submitter, Viewer**. The override applies only to that project — your global role is unchanged elsewhere.

Project membership also carries an **Agent** flag — orthogonal to role. The Agent flag controls who appears in the assignment pool for auto-assignment policies + escalation targets + `@agents` mentions on that specific project. Setting the role override to `Tech` auto-ticks the Agent flag (toggle it off afterwards if a Tech on this project shouldn't get assignments).

---

## Notes tab (handler-only)

Every ticket carries a **Notes** tab visible only to handlers. Since v0.8.0 "handler" means:

- Global Admin / Manager / Tech, **OR**
- A project member with a handler role override (Admin / Manager / Tech) on the ticket's project, **OR**
- A project member with the Agent flag on the ticket's project.

Notes are project-handler-only commentary, separate from comments:

- Never visible to submitters or vendors.
- Never fan out via email or push to non-handlers.
- `@mentions` inside notes resolve only against active agents on the ticket's project.

Use Notes for triage scratchpad ("checked DNS, ServiceNow IP responding"), shift handoffs, anything that shouldn't bleed into the comment thread the submitter reads.

Note editing (v0.8.0): author can edit their own notes; Admin / Manager can edit anyone's. Any edit shows an `(edited)` indicator with the timestamp. Audited as `note_edited`.
