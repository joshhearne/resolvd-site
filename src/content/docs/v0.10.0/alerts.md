---
title: Alerts
version: v0.10.0
order: 45
summary: Deduped state-machined alerts page distinct from the per-event audit log. Alert rules per source decide what auto-promotes to a ticket. Dashboard widget surfaces top firing alerts.
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
3. The alert evaluator (`services/alertEvaluator.js`) runs through the source's `alert_rules` in priority order:
   - `severity_min` — minimum vendor severity to consider.
   - `title_regex` — optional title match.
   - `action` — `promote_ticket` / `notify_only` / `ignore`.
4. First matching rule wins. `promote_ticket` creates a ticket via the same path as the legacy webhook → ticket flow, attaches the alert id, and stamps `alerts.ticket_id` + `alerts.promoted_at` + `alerts.promoted_by_rule_id`.
5. When the vendor fires a recovery event with the same `external_event_id`, the alert flips to `state='recovered'`, `recovered_at` is stamped. If the source has `auto_resolve_on_recovery=TRUE` and the alert has a linked ticket, the ticket auto-resolves.

---

## Alert rules

Configured at **Admin → Alert sources → {source} → Alert rules**.

```
INSERT INTO alert_rules (
  source_id, name, severity_min,
  title_regex, action, priority_order
) VALUES (
  42, 'Promote High+ for production', 2,
  '(?i)\\b(prod|production)\\b', 'promote_ticket', 10
);
```

Rules evaluate in `priority_order ASC`. First match wins. Without any matching rule, the default action is `notify_only` — the alert sits on the Alerts page + dashboard widget but doesn't manufacture a ticket. Use `severity_min: 1` + `action: ignore` as a low-priority catch-all to keep flapping Warnings entirely off the page.

**Promotion delay (since v0.10.0).** Each alert source carries an integration-wide delay (minutes) before a firing alert is promoted. An alert that recovers inside the window never opens a ticket, which keeps flapping checks from manufacturing tickets that resolve themselves. Set it on the source's edit form; `0` promotes immediately.

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
| `webhook` (generic) | webhook + tabular field-map editor | alerts (anything mappable) |

Each adapter declares a `credentialsSchema` — `name`, `kind`, `label`, `required` — which the registry-driven add form renders. Onboarding a new RMM with a webhook-flavored alert format is now a JSON edit, not a code change.

**Action1**-specific operational notes:

- Client-side rate limit via a per-source token bucket (`services/action1RateLimit.js`).
- 429 responses pause the source for the `Retry-After` window.
- The poll scheduler (`services/alertSourcePollScheduler.js`) interleaves sources so one slow tenant can't starve the others.

See `inventory.md` for how the same Action1 connection feeds the inventory module simultaneously.

---

\* This integration is an independent community project and is not affiliated with, endorsed by, sponsored by, or supported by Action1 Corporation. Action1 has not reviewed, tested, certified, or audited this integration for security, performance, or compliance purposes and is not responsible for its operation, availability, or use. "Action1" is a trademark of Action1 Corporation and is used solely to identify compatibility with the Action1 platform.
