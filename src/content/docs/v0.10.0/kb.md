---
title: Knowledge Base + Trove KB
version: v0.10.0
order: 55
summary: "The built-in per-project KB, plus the optional Trove KB integration: collections, categories, runbooks, favorites, ticket links, suggestions, resolution drafts, knowledge briefs, signed webhooks, and an optional migration off the local KB."
since: v0.7.0
---

## What it is

Resolvd ships a built-in knowledge base: per-project BlockNote articles with version history, tags, agent-only visibility, and runbook checklists. From `v0.10.0` it can also read [Trove KB](https://trove-kb.com/) through one API key and enforce its own roles on what comes back. The integration is optional. Run local only (default), local and Trove KB side by side, or Trove KB only after the optional migration below. For Trove KB content, Resolvd does not author articles; the split is:

| | Owner |
|---|---|
| Articles, runbooks, categories, collections, public vs. internal | Trove KB |
| Authoring, imports, vendor-doc crawls, favorites, helpful votes | Trove KB |
| Which articles / runbooks are linked to a ticket | Resolvd |
| Runbook step progress per ticket | Resolvd |
| Resolution summaries, knowledge briefs, AI drafts | Resolvd |
| Who in Resolvd sees internal vs. public content | Resolvd |

Users don't need a Trove KB account to read internal docs inside Resolvd. Staff who author docs sign in to Trove KB with the same identity provider; email is the join key.

---

## Setup

**Admin → Integrations → Trove KB**

| Field | Notes |
|---|---|
| Base URL | The Trove KB instance Resolvd calls (`/api/v1/kb/*`). |
| Public URL | The public Trove KB site, used for links non-admins can follow. |
| API key | Stored encrypted under `RESOLVD_MASTER_KEY`. Needs `read` scope, read grants on every collection Resolvd should see, and a `write` grant only on the collection ticket promotions land in. |
| Enabled | Master switch. |
| Strict public mode | Default on. Non-handlers see an article only when Trove KB returns it as public. |
| Auto-map public collections | Default on. New public collections are mapped Public by the hourly sync. |
| Webhook secret | Generate or paste; shown once. Register the endpoint in Trove KB. |

**Test connection** pulls the collection list. Map each collection **Internal**, **Public**, or **Hidden**. Hidden keeps it out of Resolvd entirely and is never undone by the sync (`known_collection_ids`).

**Project ↔ collection**: Admin → AI Assist → Project contexts → *Trove KB collection* (dropdown of live collections, or paste an id). Suggestions search that collection first; drafts prefer it; Promote-to-KB writes to it.

Settings live in the `trove_kb_settings` singleton.

---

## Browsing

| Route | What |
|---|---|
| `/kb` | Readable collections as cards (or a list, remembered per browser). *My favorites* when Trove KB exposes reactions. |
| `/kb/collection/:id` | Category / subcategory rail with counts; type filter (Articles / Runbooks, source format); article list sorted by title or modified, cursor-paged; search scoped to the collection. |
| `/kb/article/:id` | Markdown reader, breadcrumbs into the tree, favorite + helpful bar, *Open in Trove KB* (Admins) or the public link. |

Non-handler pages are public-confirmed per row, so a page may come back shorter than requested.

---

## Visibility

| Who | Sees |
|---|---|
| Project handlers (global Admin / Manager / Tech, or project handler override / Agent flag) | Internal + Public collections, every article the key reads. |
| Everyone else | Public collections only, and only articles Trove KB confirms public. |
| Nothing mapped | Handlers see everything the key reads; non-handlers see nothing. |

Resolvd sends `audience=public` on non-handler searches, lists, article and collection reads when Trove KB's OpenAPI declares the parameter. Otherwise it fetches each hit and keeps only those with a `public_url`. Cache keys carry the audience so handler and public views never mix. With strict mode off, the whole Public collection is trusted, held-back articles included.

Only Resolvd Admins get `base_url` / staff links. Everyone else reads in-app or via the public site.

---

## Ticket surfaces

The Trove KB block inside the ticket **Knowledge** panel:

- **Links** — `ticket_trove_kb_links (ticket_id, article_id, title, collection_id, collection_name, kind, created_by)`. Title and collection name are snapshots so the ticket reads right when Trove KB is down; refreshed nightly.
- **Suggestions** — title-based search, project collection first. Trove KB ANDs every word, so when the exact query finds nothing Resolvd retries with the title's key terms joined by OR.
- **Search-to-link** — scoped search, one click to link.
- **Resolution draft** — `POST /api/trove-kb/tickets/:id/resolution-draft`. Extractive digest always (matched passage, link, collection · category, runbook steps). AI summary when the caller may use AI Assist (org key or BYOK); logged under surface `kb_resolution_summary`. Appends to the resolution summary editor.
- **Promote-to-KB** — `POST /api/trove-kb/tickets/:id/promote`. Upserts `resolvd:ticket:<id>` into the project's collection, internal-only, category = project, subcategory Drafts. Needs the key's write scope and a write grant on that collection.

### Knowledge briefs

*Scope with knowledge* on the comment composer. `POST /api/trove-kb/tickets/:id/assist/brief` builds, with no AI, a form from trusted inputs: what the user reported (title, description, non-handler comments), what the team said, the tech's draft, the tech's corrections (carried into the next brief on the ticket), the project context, and matched articles (project collection first, then the draft's key terms) — each include / exclude with a note.

Then `…/assist/compose`:

- **Build (no AI)**, default — reply = draft + links to included *public* articles; resolution = reported + clarifications + response + article digest.
- **Rewrite with AI** — the curated brief goes to the configured provider with rules: reported / draft / corrections are true (corrections override), procedure comes only from the articles, internal articles are never named in the reply, public ones may be linked. Output is `## Reply` + `## Resolution`, logged under surface `comment_assisted`. Falls back to the extractive result on failure.

Every run is stored in `ticket_assist_briefs`. `GET …/assist/briefs` lists them (no UI yet).

**Noise filter** — Admin → Trove KB → *Assist noise filter*. Rules in `trove_kb_noise_rules`: regex, literal text, or a specific account. Built-ins (SLA notices, project moves, merges, auto-replies) are seeded rows an admin can disable, edit, or delete. A test box shows which rules a pasted comment trips. System and muted comments are always excluded.

---

## Kept in step

| Mechanism | Behavior |
|---|---|
| Webhook | `POST /api/trove-kb/webhook` receives `kb.article.upserted` / `kb.article.archived`. Mounted ahead of the JSON parser and session auth with a raw body. `X-Trove-Signature` HMAC-SHA256, constant-time compare. Drops cached article + search results, records the delivery, answers `204`. `503` without a secret, `401` bad / missing signature, `400` non-JSON. |
| Result cache | 60 s. 12 s request timeout. Errors never carry the key. |
| Search | One unfiltered call when the mapped collections are every collection the key reads; otherwise one call per collection. |
| Collection sync | `syncCollections()` hourly, on Test connection, and on *Check for new collections*. |
| Nightly snapshot | Titles and collection names on links and runbook runs refresh nightly and on demand. |
| Feature probe | Trove KB's OpenAPI is read every five minutes. Favorites / votes (`X-Trove-Reader`) and `audience` activate when declared. |
| Check for changes now | One-click poll from Admin → Trove KB. |

---

## Endpoints

```
GET    /api/trove-kb/status
GET    /api/trove-kb/collections
GET    /api/trove-kb/collections/:id                 — categories + counts
GET    /api/trove-kb/articles                        — ?collection_id= ?category= ?kind= ?sort= ?cursor=
GET    /api/trove-kb/search?q=                       — ?collection_id=
GET    /api/trove-kb/articles/:id
GET    /api/trove-kb/runbooks
GET    /api/trove-kb/tickets/:id/links
POST   /api/trove-kb/tickets/:id/links/:articleId
DELETE /api/trove-kb/tickets/:id/links/:articleId
GET    /api/trove-kb/tickets/:id/suggestions
POST   /api/trove-kb/tickets/:id/resolution-draft
POST   /api/trove-kb/tickets/:id/assist/brief
POST   /api/trove-kb/tickets/:id/assist/compose
GET    /api/trove-kb/tickets/:id/assist/briefs
POST   /api/trove-kb/tickets/:id/promote
GET    /api/trove-kb/tickets/:id/runbook-runs        — list / start / patch / delete
POST   /api/trove-kb/webhook                         — Trove KB → Resolvd
GET    /api/trove-kb-settings                        — Admin
```

---

## Migrating off the local KB (optional)

Skip this to keep both. Admin → Trove KB → **Replace local KB** shows the plan before applying: each local article's twin in Trove KB (matched by `external_id resolvd:kb:<id>`), ticket links, runbook runs, step coverage.

Apply:

1. Copies `ticket_kb_links` → `ticket_trove_kb_links`.
2. Re-keys `ticket_runbook_runs.step_states` from BlockNote block ids to Trove KB step ids (block id → first 8 hex).
3. Archives local articles.
4. Sets `local_kb_enabled = false`. The local KB UI hides; `kb_articles`, `kb_article_versions`, `ticket_kb_links` stay one release for rollback.

`backend/scripts/export-kb-to-trove-kb.js` exports BlockNote JSON to Markdown + frontmatter in Trove KB's import layout, with step ids baked in so the re-key lines up. Run it, import into Trove KB, then apply the plan.

Fresh installs, and anyone keeping the built-in KB, skip all of this.

---

## Tests

`backend/tests/troveKb*.test.mjs` cover the REST client against a mocked fetch (bearer header, hit shaping, fan-out vs single call, cache TTL + invalidation, public-only reads, OR fallback, error mapping, 502/504), the webhook receiver (signature accept / reject, 204/401/400/503), the assist builder, and the migration re-key helper.
