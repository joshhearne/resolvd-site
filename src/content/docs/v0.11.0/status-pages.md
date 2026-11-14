---
title: Status pages + maintenance windows
version: v0.11.0
order: 47
since: v0.11.0
summary: Curated status pages over monitored items for signed-in users — services and components with primary rollup, 14-day history bars, outage episodes, email subscriptions, visibility and project limits — plus maintenance windows and subscribable calendar feeds.
---

## What it is

A status page is a curated view over **monitored items** — the monitors your integrations alert on or poll (see the alerts doc; Uptime Kuma feeds live status). Pages are for signed-in Resolvd users only; there's no anonymous public page.

| Route | What |
|---|---|
| `/status` | **Status** in the left rail. Pages listed in a secondary rail (a dropdown on phones). |
| `/status/:slug` | One page. |
| `/maintenance` | **Maintenance** in the left rail (Admin / Manager / Tech). |

---

## Services and components

An item can belong to a parent item, one level deep and from the same source: the parent is a **service**, its children are **components**. Uptime Kuma group monitors act as services; webhook payloads link monitors to their group, and admins can set the parent and mark a component **primary** on the integration's item list (**Admin → Integrations → {source}**).

Service state rolls up from its components (`rollupServiceState`):

| Components | Service |
|---|---|
| None | The item's own state. |
| All in maintenance | `maintenance` |
| A **primary** component down | `down` |
| Every non-maintenance component down | `down` |
| Some components down | `partial` |
| Any pending (nothing down) | `pending` |
| All unknown | `unknown` |
| Otherwise | `up` |

Components in maintenance count as neither up nor down.

---

## Creating and editing pages

Admin / Manager. **+ New** at the top of the Status pages rail opens a name field; saving creates the page. The page editor has draggable **sections** and items, expandable services, and a per-item **display name**. Add monitored items from any integration.

| Setting | Options |
|---|---|
| Visibility | **Everyone (all roles)** or **Staff only (Admin, Manager, Tech)**. |
| Limit to project members (optional) | One or more projects. Viewers must be a member of at least one, on top of the visibility setting, so a Tech outside the project doesn't see it either. |

Admin and Manager always see every page.

---

## What a page shows

- Live state per service and component, with uptime, response time and cert days where the source provides them.
- A **14-day history bar** for every service and component. Each pip shows the worst state it saw, so a short blip still marks it. Expand / collapse per service, per section, and for the whole page.
- **Active incidents** from firing alerts.
- **Scheduled maintenance**.
- **Past 14 days** — outage episodes (down / partial runs), incidents and maintenance. Outages are listed even when no ticket was opened.

History is built from `alert_item_state_changes`, written by both the poller and the webhook path (`statusTimeline.js`). Maintenance windows overlay the timeline.

---

## Email subscriptions

Any viewer can subscribe to a page they can see (**Email me about**):

- **Up / down alerts** — when a service or component goes down or recovers.
- **Page changes** — when a new service is added to the page.

The notifier runs every minute and sends each subscriber one email per page per run. An item that went down and came back within one run is reported as a brief outage. Changes during a maintenance window are skipped. Staff-only pages only mail staff, and a subscriber who loses access stops getting emails. A failed send is logged and that batch is dropped rather than replayed later.

Alerts go out through Resolvd's own mail backend; if that is down, emails can't go out.

---

## Maintenance windows

Admin / Manager / Tech create and edit windows under **Maintenance**; Admin / Manager can delete them.

| Field | Notes |
|---|---|
| Title | e.g. *NetBox 4.x upgrade*. |
| Starts / Ends | **End now** closes a window early. |
| Affected items | Items or whole services. Their alerts are recorded but don't open tickets during the window; promotion is re-checked when the window ends, or when it's shortened or deleted. |
| Related ticket (optional) | Ticket ref, e.g. `DEV-0010`. |
| Project calendar | Which project feed carries the window. **From the affected items** or a specific project. |
| Scheduled techs | Shown on their personal calendar feeds. |
| Plan / reason | Markdown, optional. |
| What was done | Markdown, fill in as you go or afterwards. Shown on status pages as the maintenance log. |

---

## Calendar feeds

**Account settings → Calendar** gives each user subscribable `.ics` links for Outlook / Microsoft 365 and Google Calendar:

| Feed | Who | Carries |
|---|---|---|
| `mine.ics` | Any user | Maintenance windows and recurring-ticket runs assigned to me. |
| `all.ics` | Admin / Manager / Tech | All scheduled work. |
| `project/:prefix.ics` | Project access | One project's work. |
| `holidays/:id.ics` | Any active user | A business-hours policy's holidays (see the SLA doc). |

Calendar apps can't sign in, so the token in the URL is the credential. Access follows the owner's current role and project membership. **Make new links** regenerates the token and revokes every old link; **Turn off** revokes it.

---

## Endpoints

```
GET    /api/status-pages
GET    /api/status-pages/:slug
POST   /api/status-pages                     — Admin / Manager
PATCH  /api/status-pages/:id                 — Admin / Manager
PUT    /api/status-pages/:id/items           — Admin / Manager
DELETE /api/status-pages/:id                 — Admin / Manager
PUT    /api/status-pages/:id/subscription
DELETE /api/status-pages/:id/subscription
GET    /api/maintenance
GET    /api/maintenance/:id
POST   /api/maintenance                      — Admin / Manager / Tech
PATCH  /api/maintenance/:id                  — Admin / Manager / Tech
DELETE /api/maintenance/:id                  — Admin / Manager
GET    /api/calendar/me                      — your links
POST   /api/calendar/me/token                — create / regenerate
DELETE /api/calendar/me/token                — revoke
GET    /api/calendar/feed/:token/{mine,all}.ics
GET    /api/calendar/feed/:token/project/:prefix.ics
GET    /api/calendar/feed/:token/holidays/:id.ics
```
