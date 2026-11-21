---
name: update-help-page
description: Keep Resolvd's in-app Help page (frontend/src/pages/Help.jsx in joshhearne/resolvd) in sync with the UI, from a Claude Code cloud session. Run before cutting a feature tag (normally as part of cut-release). Detects what changed since the last Help.jsx edit, proposes text edits and new/refreshed screenshots, takes them against a freshly built demo, previews, and on approval opens a docs PR. Triggers — "update help page", "/update-help-page", "the help page is stale".
---

# Update Help Page (cloud)

`frontend/src/pages/Help.jsx` is JSX: role-aware `Section*` functions with access banners (`FullAccess` / `PartialAccess` / `NoAccess`), `Feature` lists, `RolePill`, `OverrideNote`, and `<HelpScreenshot src="/help/<slug>.png" alt="…" caption="…" />` slots backed by `frontend/public/help/<slug>.png` (a missing PNG shows a dashed placeholder).

Humans in the loop: don't push or open a PR without explicit approval. Commits: en-US, no `Co-Authored-By` / `Claude-Session` trailer.

## When

Ideally pre-tag (inside `cut-release`), so Help rides with the release. Avoid post-tag docs-only patch tags: fold a late Help update into the next real patch or feature tag.

## Paths

| Path | Role |
|---|---|
| `/home/user/resolvd/frontend/src/pages/Help.jsx` | The page. |
| `/home/user/resolvd/frontend/public/help/<slug>.png` | Screenshots, served at `/help/<slug>.png`. |
| `/home/user/resolvd-site/scripts/help/screenshots-help.json` | The Help screenshot plan (durable, committed in the site repo). `outDir: "../resolvd/frontend/public/help"`. |
| `/home/user/resolvd-site/scripts/take-screenshots.mjs` | Runner: `--plan <file> [--only a,b]`. |
| `/home/user/resolvd-site/scripts/cloud/demo-up.sh` | Builds and seeds the demo on :8091. |

## Inputs

- no arg → everything since Help.jsx was last touched
- `/update-help-page Zabbix alert sources` → that feature
- `/update-help-page since v0.11.0` → that range

## Phase 1 — Detect

```bash
cd /home/user/resolvd && git fetch -q --depth 300 origin +refs/heads/main:refs/remotes/origin/main +refs/heads/dev:refs/remotes/origin/dev
LAST=$(git log -1 --format=%H origin/dev -- frontend/src/pages/Help.jsx)
git log "$LAST"..origin/dev --reverse --pretty=format:'%h %s' -- frontend/src/pages/ frontend/src/App.jsx frontend/src/components/Layout.jsx
```

Categorize: **Added** (new route / admin sub-tab / page), **Changed** (restructure, renamed labels, role shift), **Removed**. Skip refactors and dependency bumps. Cross-check `ROADMAP.md` "Recently shipped".

## Phase 2 — Diagnose

`grep -n '^function Section\|<HelpScreenshot\|<ScreenshotPlaceholder' frontend/src/pages/Help.jsx`, read each affected Section, compare its claims with the current code (routes, labels, roles).

Also diff the plan against Help.jsx: every `src="/help/<slug>.png"` needs a plan entry with `"name": "<slug>"` and vice versa. Report mismatches.

## Phase 3 — Propose (wait for the user)

List per Section: text edits, new `Feature`s, role changes, new Sections (with placement), screenshots to add/refresh. Ask: apply all / a subset / abort.

## Phase 4 — Edit Help.jsx

On `docs/<tag>-help` off `origin/main` (or the branch cut-release named). Keep the existing JSX style. New section pattern:

```jsx
function SectionFooBar({ role }) {
  const access = role === "Admin" ? "full" : role === "Manager" ? "partial" : "none";
  return (
    <div>
      <h2 className="text-lg font-semibold text-fg mb-1">Section heading</h2>
      {access === "full" && <FullAccess />}
      {access === "partial" && <PartialAccess note="…" />}
      {access === "none" && <NoAccess note="…" />}
      <p className="text-sm text-fg-muted mb-3">…</p>
      <div className="border border-border rounded-lg p-3 bg-surface mb-3">
        <Feature name="Feature 1" roles={["Admin"]} note="…" />
      </div>
      <HelpScreenshot src="/help/<slug>.png" alt="…" />
      <OverrideNote />
    </div>
  );
}
```

Register it in `SECTIONS` and `renderSection` (re-read the bottom of the file). Removing a feature: delete the Section, its registry entry and its PNG.

## Phase 5 — Plan

Edit `scripts/help/screenshots-help.json` in the site repo: add/adjust entries, slug-for-slug with Help.jsx. Auth block and recipes: `cut-release/references/screenshots.md`.

## Phase 6 — Demo

```bash
cd /home/user/resolvd-site && DEMO_BRANCH=<help branch or main> APP_VERSION=<tag> scripts/cloud/demo-up.sh
```

The help branch must be pushed for demo-up to build it (it clones from GitHub). Document only what the demo can render.

## Phase 7 — Shoot and review

```bash
cd /home/user/resolvd-site && node scripts/take-screenshots.mjs --plan scripts/help/screenshots-help.json [--only a,b]
```

Review every image (contact sheet) before the user sees it.

## Phase 8 — Preview and loop

Rebuild the demo from the help branch (`--no-build` is not enough after Help.jsx changes; PNG-only changes need a rebuild too, since they are baked into the frontend image), capture the touched Help sections at `http://localhost:8091/help`, send with `SendUserFile`. Loop on text edits and `--only` reshoots until approved.

## Phase 9 — Ship

Stage `frontend/src/pages/Help.jsx` and `frontend/public/help/` (new, changed, deleted). Commit `docs(help): <summary>` (body: bullets in user terms). With approval: push the branch, open the PR to `main`. Commit the updated plan to the site repo with the release's site commits.

## Wrap up

Commit SHA, PR link, PNGs added/changed/deleted, Sections touched.
