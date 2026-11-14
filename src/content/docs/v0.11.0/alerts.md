---
title: Alerts
version: v0.11.0
order: 45
summary: Deduped state-machined alerts page distinct from the per-event audit log. Alert rules per source decide what auto-promotes to a ticket. Uptime Kuma adapter, monitored items with project pins, dashboard widget.
since: v0.7.0
---

## Two tables, one purpose

| Table | Role |
|---|---|
| `external_alert_event` | Immutable audit log. One row per webhook fire / poll match. Never updated. |
| `alerts` | Deduped state-machined record. One row per `(source_id, external_event_id)` pair. Transitions `firing` → `recovered` as the vendor fires + clears. |

A noisy alert that flaps 17 times in an hour writes 17 audit rows but lives as a single `alerts` row with `refire_count = 17` and a refreshed `last_seen_at`. The Alerts page reads from `alerts`; the audit trail is available on the alert detail panel for forensics.

---

## Lifecycle

1. Webhook fire / API poll match lands in `services/alertIngest.js`.
2. The shared pipeline writes one `external_alert_event` row (audit) + upserts the `alerts` row (`first_seen_at` set on insert, `last_seen_at` always refreshed, `refire_count` incremented on update).
3. The alert evaluator (`services/alertEvaluator.js`) walks the source's enabled `alert_rules` in `priority` order (lower first). The first rule whose conditions all match decides what happens.
4. `create_ticket` opens a ticket (after any delay, see below), attaches the alert, and stamps `alerts.ticket_id`, `promoted_at` and `promoted_by_rule_id`. `suppress` and `ignore` mark the alert `suppressed` with the rule named as the reason. If no rule matches, nothing happens: the alert stays on the Alerts page and dashboard widget without a ticket.
5. When the vendor fires a recovery event with the same `external_event_id`, the alert flips to `state='recovered'`, `recovered_at` is stamped. If the source has `auto_resolve_on_recovery=TRUE` and the alert has a linked ticket, the ticket auto-resolves.

---

## Alert rules

Configured per source under **Admin → Integrations → {source} → Alert promotion rules**. Each rule has a name, a **Priority (lower = first)**, an **Action** (**Create ticket**, **Suppress (mark handled)** or **Ignore**), a **Delay (minutes)** for Create ticket, and match conditions. Unset conditions match anything; every set condition must pass:

| Condition (`match_conditions` key) | Matches when |
|---|---|
| `severity_min_rank` | The alert's severity is this rank or worse (1 = Disaster/Critical, 2 = High/Error, 3 = Average/Warning, 4 = Low, 5 = Info) |
| `title_contains` / `title_excludes` | The title contains any / none of the listed words (case-insensitive) |
| `description_contains` / `description_excludes` | Same, on the description |
| `title_regex` | The title matches the pattern (case-insensitive; an invalid pattern never matches) |
| `user_email_domain` | The alert's user email ends with this domain |

A Create ticket rule can also set ticket overrides (`ticket_overrides`): a priority instead of the source's severity map, and a project. A project pin on the alert's monitored item, or on its parent service, beats the rule's project, which beats the source default.

Example: open tickets only for High-or-worse production alerts, and file everything else quietly:

| Priority | Name | Conditions | Action |
|---|---|---|---|
| 10 | Prod High+ | `severity_min_rank: 2`, `title_regex: \b(prod\|production)\b` | Create ticket |
| 100 | Everything else | none | Suppress |

**Promotion delay (since v0.10.0).** Each alert source carries an integration-wide delay (minutes) before a firing alert is promoted. A rule's own **Delay (minutes)** replaces it when set. An alert that recovers inside the window never opens a ticket, which keeps flapping checks from manufacturing tickets that resolve themselves. Set it on the source's edit form; `0` promotes immediately.

---

## Manual promote

Each alert detail page carries a **Promote to ticket** button. Writes `kind='manual'` to the audit log; sets `promoted_by_user_id` + `promoted_at`.

---

## Dashboard widget

`/api/alerts?state=firing&limit=8` feeds the **Active alerts** card on the dashboard. Visible to Admin / Manager / Tech.

The widget respects the dashboard's project filter — pass `&project_id=N,M` to scope. Useful when a single user juggles multiple customer projects.

---

## Integration registry

Built-in adapters live in `services/integrations/registry.js`:

| Vendor | Kind | Capabilities |
|---|---|---|
| Zabbix | `webhook` + optional REST backfill | alerts |
| Action1 | `rest_poll` (OAuth2 client-credentials) | alerts + inventory + software + vulnerabilities + companies |
| Uptime Kuma (since v0.11.0) | `webhook` + optional `/metrics` status poll | alerts + status |
| `webhook` (generic) | webhook + tabular field-map editor | alerts (anything mappable) |

Each adapter declares a `credentialsSchema` — `name`, `kind`, `label`, `required` — which the registry-driven add form renders. Onboarding a new RMM with a webhook-flavored alert format is now a JSON edit, not a code change.

**Action1**-specific operational notes:

- Client-side rate limit via a per-source token bucket (`services/action1RateLimit.js`).
- 429 responses pause the source for the `Retry-After` window.
- The poll scheduler (`services/alertSourcePollScheduler.js`) interleaves sources so one slow tenant can't starve the others.

See `inventory.md` for how the same Action1 connection feeds the inventory module simultaneously.

---

## Uptime Kuma (since v0.11.0)

**Alerts.** Add a Kuma integration under **Admin → Integrations**, then add a Kuma *Webhook* notification pointing at the tokenized `/api/webhooks/in/<token>` URL (the new-token banner shows it with a copy button, plus the internal `resolvd-nginx` URL). Kuma's default webhook JSON works as-is. Attach the notification to individual monitors, not to groups, or a group and its child will each open a ticket.

- `DOWN` opens an alert, promoted per the source's alert rules.
- `UP` recovers it.
- Test pings, `PENDING` and `MAINTENANCE` beats are acknowledged and ignored.

Kuma sends no per-outage id, so alerts correlate by monitor (`item_key = monitor:<id>`): a `DOWN` while the monitor has an open alert refires that alert, and a recovery closes the monitor's latest unrecovered alert.

**Live status.** Create a key in Kuma under *Settings → API Keys*, tick **Poll live status from Kuma** in the setup box, and fill in:

| Field | Notes |
|---|---|
| Kuma API base (polled from the Resolvd server) | `api_url`. An internal Docker URL such as `http://uptime-kuma:3001` works. |
| Kuma API key | `api_token`, stored encrypted. Sent as basic-auth password with an empty user. |
| Kuma web URL | Human-facing base for *Open in Uptime Kuma* links, when it differs from the API base. |

The poller reads Kuma's Prometheus `/metrics` every 55 s for each monitor's state, 1-day / 30-day uptime, response time and cert days. Kuma has no other REST API.

**Networking.** `resolvd-nginx` and the backend join a fixed-name Docker network, `resolvd-alert-intake`. Put the Kuma container on it (as an external network) so Kuma can reach the webhook and Resolvd can poll Kuma; Postgres isn't on that network.

---

## Monitored items (since v0.11.0)

Every monitor an integration alerts on or polls becomes a row in `alert_monitored_items` (one per `(source_id, item_key)`). State changes, whether from a webhook or a poll, are recorded in `alert_item_state_changes`; status pages build their history from it. Items that drop out of a poll are marked inactive, not deleted, so pins and history survive a renamed monitor.

On the integration's item list (Admin / Manager), each item can be:

- **Pinned to a project** — when its alert is promoted, the pin beats rule overrides and the source default.
- **Assigned to a service** (a parent item, one level deep, same source) and marked **primary**. Kuma group monitors act as services. See the status pages doc for the rollup rules.

**Maintenance windows** hold back promotion: while a window covers an item (directly or through its service), its alerts are recorded but don't open tickets. Promotion is re-checked when the window ends, or when it's shortened or deleted.

---

\* This integration is an independent community project and is not affiliated with, endorsed by, sponsored by, or supported by Action1 Corporation. Action1 has not reviewed, tested, certified, or audited this integration for security, performance, or compliance purposes and is not responsible for its operation, availability, or use. "Action1" is a trademark of Action1 Corporation and is used solely to identify compatibility with the Action1 platform.
