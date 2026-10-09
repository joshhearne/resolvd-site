---
title: Runbooks
version: v0.10.0
order: 27
since: v0.9.0
summary: Checklist articles authored in Trove KB (kind runbook), run from the ticket Runbook tab with per-ticket step state and canned-response pills.
---

A **runbook** is a Trove KB article with `kind: runbook`. Trove KB derives a `steps[]` array from the Markdown on save; Resolvd renders the checklist on the ticket's **Runbook** tab and keeps the progress.

## Authoring (in Trove KB)

1. Create an article, set kind **Runbook**.
2. Steps are Markdown task-list items (`- [ ] text`). Headings, paragraphs, and plain bullets render as section labels around the boxes.
3. Each step gets a stable `id`, minted on first save and preserved by text match. Override with `- [ ] {#my-id} text` when you want it explicit — ticket progress is keyed by this id, so it must survive edits.
4. Nested bullets under a step become its `note` (Markdown).
5. A step may carry `canned: <slug>`. On the ticket it becomes a 📋 pill that prefills the comment composer with that canned response, placeholders (`{ticket.ref}`, `{submitter.firstName}`, …) substituted server-side.

```
## Mitigate
- [ ] {#gpo-revert} Schedule GPO revert (TCP keepalive 30 → 2 min), pilot on IT OU
- [ ] {#vendor} If the vendor needs to engage the Outlook side
  - canned: vendor-escalation
```

`GET /api/v1/kb/articles/:id` on Trove KB returns `kind`, `steps[{id, text, note?, canned?}]`.

## Running

Open a ticket as a project handler. **Runbook** tab → **+ Start a runbook** → pick from runbooks in the project's mapped collection (`GET /api/trove-kb/runbooks`, filtered `kind=runbook`).

State is keyed by `(ticket_id, trove_kb_article_id)`. Opening the same runbook on a different ticket gets independent checkboxes. Each tick records who and when. **Reset** clears the run; **Mark complete** stamps `completed_at`.

Recurring ticket schedules can name a runbook; every fire starts a run on the new ticket.

## Permissions

- Read / write / delete a run: project handler on the ticket's project.
- Author a runbook: whatever Trove KB grants that person on the collection.
- Non-handlers never see runbooks from internal collections.

## Schema

`ticket_runbook_runs` (`ticket_id`, `trove_kb_article_id UUID`, `trove_kb_title`, `step_states JSONB`, `started_by`, `started_at`, `completed_at`). Unique on `(ticket_id, trove_kb_article_id)`. `step_states` is `{ stepId: { checked, checked_by, checked_by_name, checked_at } }`; toggles use a Postgres `jsonb ||` merge so concurrent handlers don't clobber each other. `trove_kb_title` is a nightly-refreshed snapshot. `article_id` (local KB) is nullable and only populated on runs created before the migration.

## Future direction (exploratory, no commitment)

A step could reference a ScreenConnect BackStage script or an Action1 deployment and run it against the ticket's linked asset, capturing output back into the step. Vendor-gated; tracked under exploratory items on the app `ROADMAP.md`.
