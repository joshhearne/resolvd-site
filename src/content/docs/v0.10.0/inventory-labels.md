---
title: Asset tags, custody log, label printing
version: v0.10.0
order: 36
since: v0.9.0
summary: Operator-facing asset tags, custody check-out / check-in trail, Zebra label printer with QR deep-links.
---

## Asset tags

Operator-facing inventory IDs that survive RMM syncs. Distinct from the OS-reported hostname.

- New column `assets.asset_tag` (nullable, indexed).
- Editable on both manual + RMM-managed assets via Inventory → asset detail.
- Action1 attribute mapper accepts `asset_tag` as a target; the AdminAlertSources target dropdown lists it.
- Action1 sync uses `COALESCE` so admin-supplied tags survive a pull where the source has the slot empty.

## Custody log

`asset_checkouts` table tracks possession over time. One row per check-out / check-in pair, separate columns for the holder + actor (`out_by` / `in_by`), free-text notes.

- Partial unique index on `asset_id WHERE in_at IS NULL` enforces one active checkout per asset. A double check-out 409s at the route.
- Custody panel on the asset detail page exposes Check out / Check in actions and the full event log.
- `linked_user_id` auto-tracks the active holder so the legacy "who has this?" UI reflects current possession.

Roles:

- View custody log: handler (gated with the rest of Inventory in v0.9.0).
- Check out / check in: handler.

## Label printer

Single-row `label_printer_config` (`host`, `port`, `dpi`, `media_width_mm`, `media_height_mm`, `top_offset_dots`, `property_line`). Connection opens raw TCP `:9100` with an 800 ms post-write hold so the printer can ack before tear-down.

### Surface

| Endpoint | Purpose |
|---|---|
| `GET / PATCH /api/label-printer` | Read / update the config row (Admin). |
| `POST /api/label-printer/test` | Fire a known-shape test label to validate alignment. |
| `POST /api/assets/:id/print-label` | Send an asset label to the printer (handler). |
| `POST /api/consumables/:id/print-label` | Send a consumable label (handler). |

Admin UI lives at **Admin → Site → Label printer**. Print buttons appear on the Inventory asset detail + Consumables detail pages.

### Label layouts

- **Test label** — known-shape ZPL, prints the printer config readback so you can verify mm sizing + offsets.
- **Asset label** — first line `asset_tag` (faux-bold via 1-dot horizontal double-strike — the default scalable font has no bold weight). Second line `hostname` only when distinct from the tag. Blank visual row. Property-line footer is the admin-configurable string.
- **Consumable label** — same layout, `part_no` on the lead line, vendor company on the property line.

QR encodes `FRONTEND_URL + /inventory/<id>` (or `/consumables/<id>`). Right-justified inside the die-cut radius; text column clamps to `qrX − 23` dots so long hostnames truncate instead of overlapping the code.

### Top offset range

`top_offset_dots` accepts `-120..+120`. ZPL `^LT` supports the full range; some printers have a positive bias the operator needs to correct downward. Set once after the test-label dry run.

### Unconfigured state

If no row exists / no host is set, the Print buttons render disabled with a hint pointing at Admin → Site → Label printer. No exception is thrown.
