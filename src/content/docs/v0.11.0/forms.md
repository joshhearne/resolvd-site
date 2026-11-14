---
title: Custom forms + computed fields
version: v0.11.0
order: 23
since: v0.10.0
summary: Project-scoped category → form → field model with per-form required, agent-only and sensitive flags, multiselect, deep-linkable new-ticket URLs, {field.slug} tags, formula-driven computed fields, applying a form to an existing ticket, and ad-hoc fields.
---

## Model

`ticket_categories` → `ticket_forms` → `ticket_form_fields` → `custom_field_defs`, all scoped to a project.

- A **field def** is project-local by default, with a tag-prefixed slug (`hr-username`) and a collision guard. Soft-archive, never hard delete. Flags: `sensitive` (encrypted at rest, revealed to composing agents), `agent_only` (hidden from submitters), `computed`.
- A **form** binds fields with a per-form **required** flag, so a field is mandatory only on the forms that opt in. Forms carry a default title / description that pre-fill new tickets. `PUT /forms/:id/fields` skips invalid / archived / out-of-scope defs and returns `{saved, skipped}`.
- A **category** can set a default form, auto-selected on new ticket (a sole form auto-selects too).
- `tickets.form_id` records which form created the ticket. Values live in `custom_field_values` (`ticket_id`, `value_text`, `value_text_enc`).

Field types: text, textarea, number, date, select, **multiselect** (JSON-array values; checkbox group on the form and the card; options-validated; joined display), **computed**.

## Agent-only fields

Hidden from the submitter's new-ticket form. Handlers fill them on the ticket's right-hand **Custom Fields** card, per-field or save-all, via `PATCH /api/tickets/:id/custom-fields`.

## Apply a form to an existing ticket (since v0.11.0)

**Apply form…** (or **Change form**) in the ticket header and mobile menu turns a ticket filed without a form into the right request type, or swaps its form. Admin / Manager / Tech. Form-less tickets show a **Request type** card with the same action.

The dialog walks project → category → form, with optional field values and a preview of the form's default title / description.

- If the form belongs to another project, the ticket **moves** there first (same path as Move: new ref, contacts detached, audited). The dialog warns before it does.
- Sets `form_id`, writes any supplied values, and posts a system note summarizing the conversion and move, quoting the form's default title / description.
- The submitter's title and description are never overwritten.
- Required fields aren't enforced; the response lists what's still missing.
- Any invalid value rolls back the whole operation, move included.

## Ad-hoc fields (since v0.11.0)

Handlers can attach individual custom fields to any ticket, with or without a form: **+ Add field** on the Custom Fields card. Eligible defs: ticket entity, not archived, shared or local to the ticket's project.

- Stored in `ticket_adhoc_fields (ticket_id, field_def_id, added_by)`. Ad-hoc fields show an *(added)* tag and a remove button.
- Removing one clears its value. Form-bound fields can't be removed.
- Ad-hoc computed fields recompute like form fields. `PATCH …/custom-fields` and `POST …/recompute-fields` no longer require a form.
- Audited as `custom_field_added` / `custom_field_removed`.

The Custom Fields card now always renders for handlers: the form name with **Change**, or *No request type* with **Apply form**.

## `{field.<slug>}` tags

Resolve in canned responses and vendor email templates (hyphen-tolerant; sensitive values revealed for the composing agent; HTML-escaped in HTML templates; sample value in preview). Both editors insert tags at the caret and expose a project-scoped *Custom fields* chip group. Multiselect joins values.

## Default project (since v0.11.0)

Admins set an organization default under **Admin → Branding → Default project** (for example, an Incident project). Each person can override it under **Account settings → Preferences → Default project**; leaving it unset follows the org default. Only active projects count. New Ticket, Export and New KB article start on the effective default.

## CC followers when filing (since v0.11.0)

The New Ticket form has a **CC / Followers** picker. Submitters can use it too: the picker only offers people allowed to follow tickets in that project, under the same restrict-followers-to-members rule as adding a follower later (Admins are exempt). Each CC'd person gets a direct notice instead of the generic new-ticket broadcast, and each add is audited as `follower_added`.

You, and the submitter when filing on someone's behalf, appear as automatic follower chips. Remove a chip to file without following.

## Deep-linkable new-ticket URLs

```
/tickets/new/<project-prefix>/<category-slug>/<form-slug>?<field-slug>=<value>&<multi-slug>=1,3
```

Segments resolve left-to-right; selects pre-fill by 1-based option number. Admin → Forms has a shareable-link builder with editable category / form slugs and optional per-field prefills.

## Computed fields

A computed field derives its value from a formula over the ticket context. Computed defs are always `agent_only`, stored as text, excluded from create validation and manual patch.

**Inputs:** `{field.<slug>}` (form inputs), `{ticket.*}`, `{submitter.*}`, `{assignee.*}`, `{actor.*}`.

**Functions:** `slice left right upper lower cap pad trim len digits replace match concat default if datepart`. `~` concatenates. Arithmetic and comparisons. No `eval`, no `Function`, no global access — `services/formula.js` is a tokenizer, recursive-descent parser, and tree-walk evaluator.

```
# AD / M365 UPN from first initial + last name
lower(left({field.hr-first-name}, 1) ~ {field.hr-last-name}) ~ "@" ~ {field.hr-domain}

# Initial password: capitalized last name + 4 digits of the start date
cap({field.hr-last-name}) ~ datepart({field.hr-start-date}, "MMdd") ~ "!"
```

**Evaluation:** automatically on ticket create (post-commit, best-effort) and on demand via `POST /api/tickets/:id/recompute-fields`. `POST /api/custom-fields/formula-preview` dry-runs a formula against sample context. The Custom Fields card shows a **Derived (auto)** section, read-only, with a recompute button.

## Admin

- **Admin → Forms / Fields** — categories, forms, field defs, the formula editor with cursor-insert tag chips and an inline demo preview, the shareable-link builder.
- **Admin → Assets / Fields** — custom fields for assets and consumables (defs only for consumables in this release).

## Endpoints

```
GET/POST/PATCH    /api/custom-fields                    — defs (?project_id= ?entity_type=)
POST              /api/custom-fields/formula-preview
GET/POST/PATCH    /api/ticket-categories
GET/POST/PATCH    /api/forms
PUT               /api/forms/:id/fields
PATCH             /api/tickets/:id/custom-fields
POST              /api/tickets/:id/recompute-fields
POST              /api/tickets/:id/apply-form              — since v0.11.0
GET/POST          /api/tickets/:id/fields                  — ad-hoc fields, since v0.11.0
DELETE            /api/tickets/:id/fields/:defId
```
