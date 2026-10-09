---
title: Custom forms + computed fields
version: v0.10.0
order: 23
since: v0.10.0
summary: Project-scoped category → form → field model with per-form required, agent-only and sensitive flags, multiselect, deep-linkable new-ticket URLs, {field.slug} tags, and formula-driven computed fields.
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

## `{field.<slug>}` tags

Resolve in canned responses and vendor email templates (hyphen-tolerant; sensitive values revealed for the composing agent; HTML-escaped in HTML templates; sample value in preview). Both editors insert tags at the caret and expose a project-scoped *Custom fields* chip group. Multiselect joins values.

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
```
