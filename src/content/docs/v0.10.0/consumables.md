---
title: Consumables
version: v0.10.0
order: 38
since: v0.9.0
summary: Supply inventory with append-only ledger — toner, drums, batteries, anything that's interchangeable.
---

Consumables track stock of items Inventory shouldn't store per-serial — toner cartridges, spare drum kits, UPS batteries, replacement keyboards. Distinct from `assets` so the durable-stuff schema doesn't accumulate fungible-stuff rows.

## Schema

- `consumables` — `part_no` (unique), `vendor_company_id`, `name`, `current_stock`, `low_stock_threshold`, `notes`, `archive` flag.
- `consumable_movements` — append-only ledger. `consumable_id`, `delta` (signed int), `reason`, `ticket_id` (nullable), `by_user_id`, `at`, `note`.

Every stock change runs `UPDATE consumables SET current_stock = current_stock + $delta` + `INSERT consumable_movements …` in the same transaction. Direct `PATCH /current_stock` is rejected with `400 "use /:id/move"` so the audit trail can't be bypassed.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/consumables` | List (search, archive filter). |
| `POST /api/consumables` | Create. |
| `GET / PATCH / DELETE /api/consumables/:id` | Read / update metadata / soft-archive. |
| `POST /api/consumables/:id/move` | Atomic stock adjust + ledger insert. |
| `GET /api/consumables/:id/movements` | Newest-first ledger. |
| `POST /api/consumables/:id/print-label` | Send a label to the printer. |

`POST /:id/move` body shape:

```json
{
  "delta": -2,
  "reason": "issued",
  "ticket_id": 4521,
  "note": "Toner for ACME-0042"
}
```

## UI

- **Consumables** top-nav entry, parallel to Inventory. Handler-only.
- List page: search box, low-stock chip, archive toggle, count by vendor.
- Detail page: stock card (current + threshold), inline edit, +/- stock controls, full ledger table, Print label button.

Crossing the low-stock threshold after a dispatch posts a 🟡 system comment on the ticket and an admin notification carrying the restock CTA (purchase URL for self-serve, vendor contact copy for metered).

## Allocation on label print (since v0.10.0)

Printing a consumable delivery label from a ticket allocates stock. The first dispatch for a `(ticket, consumable)` pair locks the row, decrements `current_stock` by 1, and logs a movement with host + date in the note. At zero stock the print is refused with `409`, a system comment lands on the ticket, and admins get a notification with the restock CTA. Reprints skip the decrement and log a zero-delta movement so the ledger still shows the extra label.

New columns: `purchase_url`, `vendor_part_no`, `is_metered`, `reorder_qty`, and `location` (shelf / bin). A standalone **shelf label** prints `part_no` + location for bin marking, separate from the delivery label. Two global canned responses are seeded under category `consumable_restock` (self-serve RFQ vs. metered / leased restock); canned rendering resolves `{consumable.*}`, `{vendor.*}`, `{ticket.host}`, `{user.display_name}`, falling back to the ticket's most recent movement when no consumable is supplied.

**Matching.** Alert ingest reads a `part.number` tag (Zabbix `event_tags` string or structured `tags[]`) and matches `part_no` / `vendor_part_no` at promotion time, posting a system comment for unmatched / out-of-stock / low / missing-data cases. The print modal auto-selects the match and never silently defaults to the first consumable; **↻ Rescan** re-runs the match against the alert tag and the latest title + description (longest `part_no` match wins).

## Common operations

- **Receive shipment** — Detail → `+ N` with reason `received`, optional vendor PO note.
- **Issue to ticket** — Detail → `- 1` with reason `issued`, link to ticket. Or print a delivery label from the ticket itself, which allocates automatically.
- **Disposal / recall** — `- N` with reason `disposed`. Reason values are free-text but the seeded list is `received | issued | returned | disposed | count_correction | loss`.
- **Count correction** — when a manual recount disagrees with the on-screen number, log a `count_correction` movement with the delta. Keeps the discrepancy on the audit trail rather than hiding it inside an edit.
