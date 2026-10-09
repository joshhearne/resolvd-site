---
title: Comments and Notes
version: v0.10.0
order: 25
since: v0.8.0
summary: Edit, lock, and (edited) indicator semantics for comments + notes.
---

## Editing a comment

Author can edit their own comments; Admin / Manager can edit anyone's. System comments and inbound vendor replies are not editable.

**Reply-lock:** the Edit action only appears on the most recent non-system comment. Once anyone posts a reply, the prior comment is frozen. Add a follow-up correction instead of stealth-editing context the next reader was responding to.

**AI provenance scrub:** editing clears the per-comment `ai_*` snapshot (provider / model / tokens / tone / verbosity / publish_consent / project_context_used). The comment is no longer purely AI output once a human revises it.

**Vendor outbound is NOT re-sent.** Vendors already have the original email. If the correction must reach them, post a follow-up comment with `is_external_visible=true`.

**Audit:** every edit writes a `comment_edited` row in `audit_log`.

## The "(edited)" indicator

A `(edited)` badge appears next to the comment's timestamp once edited — but only if **distribution happened before the edit**. The motivation: a quick self-correction nobody else has seen yet shouldn't shout "edited" forever.

A comment's `distributed_at` is stamped when:

- Any non-author user opens the ticket thread for the first time since the comment was posted, OR
- The internal follower / mention fanout fires for that comment (an email goes out to at least one non-author non-vendor recipient).

Vendor outbound does NOT stamp `distributed_at` — vendors are out of band and the badge is a UI cue for internal readers.

The indicator condition: `edited_at IS NOT NULL AND distributed_at IS NOT NULL AND distributed_at <= edited_at`.

**Backfill on upgrade:** all comments that existed before v0.8.0 are stamped `distributed_at = created_at` on first startup (with a 1-minute floor for rows that landed right before the migration). Old comments edited post-upgrade always show `(edited)`.

## Editing a note

Author or Admin / Manager can edit a posted note. No reply-lock — notes are handler-only and don't have a public reply thread that the lock semantics would protect.

No distribution gating either — notes never fan out to non-handlers, so any edit always shows `(edited)`.

Audited as `note_edited`.

## Image attachment lightbox

Image attachments (mimetype `image/*` or filename ext jpg/jpeg/png/gif/webp/bmp/svg) render as inline thumbnails on the comment timeline and the Attachments tab. Click any thumbnail to open the fullscreen lightbox:

- Filename label top-left.
- `Download` button bottom-right (drops a copy with the original filename).
- Close via `Esc`, click-outside, or the `×` top-right.

Backed by the existing `/api/attachments/:id/view` endpoint — same auth as the file download path. Non-image attachments stay rendered as paperclip chips / list rows.
