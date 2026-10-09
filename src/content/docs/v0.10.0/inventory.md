---
title: Inventory
version: v0.10.0
order: 50
summary: Managed asset list aggregated from RMM integrations + manual entry. Asset types, custom fields, ticket linking, security posture, software list, attribute mapping.
since: v0.7.0
---

## What lives in Inventory

One row per managed machine. Sources today:

- **Action1** API polling (per-org endpoint sync).
- **Manual entry** — admins / managers / techs can add anything not in an RMM (printers, deskphones, NVRs).

Uniqueness keyed on `(source_system, source_external_id)`. Each asset carries hardware identity (hostname / serial / MAC / IP / manufacturer / model / OS / CPU / RAM / storage), security posture (missing updates + vulnerabilities + reboot required), cross-references (linked user, company, asset type), and a JSONB blob of the raw upstream payload for debugging.

## Asset types

Twelve seeded:

| Type | Required fields |
|---|---|
| Workstation / Laptop / Server | hostname (required), serial, mac, ip, manufacturer, model, os, cpu, ram, storage |
| Printer / VoIP phone / Network switch / Wireless AP / UPS / NVR-DVR | hostname, serial, manufacturer, model, ip, mac |
| Monitor / Mobile | serial, manufacturer, model |
| Other | catch-all, all fields available |

Admin can create custom types with their own field schemas under **Admin → Workflow → Custom fields** (custom fields list) — though full custom-type CRUD will land in v0.8.0. For now, monkey-patch via direct SQL or use the `Other` type as a workaround.

Identity floor: at least one of hostname, serial, or MAC required on manual create. Monitors don't need a hostname.

## Action1 integration

Enable on a per-source basis: Admin → Alert sources → pick the Action1 source → tick **Feed inventory module**. The next poll cycle (interval set on the source) walks every visible organization's managed endpoints + upserts assets.

Three paths the syncer hits per cycle:

| Endpoint | Purpose |
|---|---|
| `GET /api/3.0/organizations` | Resolve org IDs (already used for alerts). |
| `GET /api/3.0/endpoints/managed/{org}/{ep}?fields=*` | Per-endpoint hardware + security posture. |
| `GET /api/3.0/apps/{org}/data/{ep}` | Per-endpoint installed software (on-demand button or 7-day auto). |

Action1's custom-attribute slots (`Custom Attribute 1` through `Custom Attribute 30`) map per-source via **Custom attribute mapping** on the source detail page. Each slot can route to an asset column or a custom field def. The picker shows each slot's most-recent sample value so you're mapping against real data.

## Company resolution

Two-step priority at sync time:

1. **Whole-source pin** — `inventory_company_id` on the source. Useful for single-tenant integrations (Zabbix dedicated to one customer). Set once; every asset gets that company.
2. **Per-org mapping** — `company_map` JSONB on the source. Routes specific org names to specific Resolvd companies. Useful for multi-tenant sources where org names don't match Resolvd company names verbatim (e.g. `"Stratus Systems — HQ"` and `"Stratus Systems — DC2"` both map to one Stratus Systems Inc. company).
3. **Per-asset name match** — if neither override applies, the sync falls back to exact case-insensitive match between the source's org name and Resolvd company names.

## Ticket linking

Per-project toggle (`allow_asset_linking` on `projects`). When on, ticket detail pages get a **Linked asset** card with a typeahead picker. Optional company filter restricts pickable assets to specific Resolvd companies (MSP isolation: customer A's tickets can't link to customer B's assets).

Asset detail shows ticket history for everything linked to that asset.

## UPN matcher

Action1 reports each endpoint's last-logged-in user as a plain string. On every sync, the matcher generates plausible aliases for every active Resolvd user (display-name + email derivations: `joshhearne`, `jhearne`, `joshh`, `josh`, `hearne`, `hearnejosh`, etc.) and tries to find a unique match. Ambiguous matches refuse to guess and leave `linked_user_id` NULL — admin can correct manually.

## Security posture

Sourced from Action1's per-endpoint payload (`missing_updates`, `vulnerabilities`, `update_status`, `vulnerability_status`, `reboot_required`). Surfaced as:

- **List columns** — Patches + Vulns with critical-red badges.
- **Detail card** — Security posture section with status pills (SUCCESS / WARNING / ERROR) + reboot-required flag.

## Software inventory

On-demand per asset via **Sync now** on the asset detail. Scoped to computer-type assets (Workstation / Server / Laptop). Auto-sync runs in the existing alert poll scheduler: 2 stale (NULL or > 7 days) computer-type assets per source per tick — spread keeps API load light.

Re-sync drops uninstalled packages automatically. Search by name or vendor.

## Offline detection

14-day threshold. Amber pill on hostnames where `last_seen_at` is NULL or older than 14 days. Toggle **Offline only** in the toolbar to filter the list.

## CSV export

`GET /api/assets/export.csv` (or the **Export CSV** button) downloads the current filtered view as a 26-column CSV with identity, hardware, security posture, source, timestamps. Honors the same `q` + `offline_days` filters as the list endpoint.
