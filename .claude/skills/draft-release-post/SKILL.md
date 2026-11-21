---
name: draft-release-post
description: LEGACY post-tag Resolvd blog flow, from a Claude Code cloud session. Prefer /cut-release (pre-tag). Use only when the vX.Y.0 tag already exists and just the blog post is missing. Triggers — "draft release post", "/draft-release-post", "release blog post for vX.Y.0".
---

# Draft Release Post (legacy, post-tag, cloud)

Use `cut-release` when the tag hasn't been cut. This is the catch-up path: the tag exists, the blog doesn't.

## Validate

1. Tag is `vX.Y.0` (patches and pre-releases get no post).
2. Tag exists: `git -C /home/user/resolvd fetch --depth 300 --tags origin && git -C /home/user/resolvd rev-parse "<tag>^{commit}"`.
3. `src/content/blog/<tag-dashes>.md` doesn't exist (else ask, offer a diff).
4. Help staleness: if frontend pages changed in `PREV..TAG` but Help.jsx didn't, warn and offer `update-help-page` (its result then rides in the next tag).

## Steps

Follow `cut-release` for the details; only these phases apply:

1. **Draft** (cut-release Phase 4, blog only): `git log PREV..TAG`, group `feat` commits, pick 3–5 headline features, read ROADMAP "Recently shipped". Frontmatter `title`, `tag`, `publishDate` (tag date), `summary`, `featured`, `icon`, `pillLabel`. Under ~800 words, voice of the previous post, no invented features, image refs slug-for-slug with the plan.
2. **Plan** `public/blog/<tag-dashes>/screenshots.json` (minimal first pass: page render + h1 wait).
3. **Demo:** `DEMO_BRANCH=main APP_VERSION=<tag> scripts/cloud/demo-up.sh` (main is the tag here, or check out the tag by setting `DEMO_BRANCH` to a branch at it).
4. **Shoot, review, preview, loop** (cut-release Phases 5–6).
5. **Ship** with approval: `feat(blog): <tag> release post`, push site `main`.

Commits: no `Co-Authored-By` / `Claude-Session` trailer.
