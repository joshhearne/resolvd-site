---
name: cut-release
description: Pre-tag release orchestrator for Resolvd feature releases (vX.Y.0), run from a Claude Code cloud session. Diagnoses the dev→main range, writes What's new change files, drafts the blog post, Help.jsx updates and versioned docs snapshot, stands the demo up from scratch and seeds it, takes and reviews screenshots, previews, then (with approval) merges, pushes the site, tags main, and opens the main→dev merge-back. Also covers post-release site work (feature pages and cards). Use for "cut a release", "ready to tag vX.Y.0", "/cut-release". For Trove KB use trove-release.
---

# Cut Release (Resolvd, pre-tag, cloud)

Everything a feature release needs ships **before** the tag: change files, Help page, blog post, docs snapshot, screenshots. The tag is last. If the tag already exists, use `draft-release-post`.

Every push, PR, tag and public deploy needs the user's explicit go-ahead in this session. Pushing site `main` deploys publicly (Cloudflare Pages); pushing a tag publishes images.

References (read at that phase): `references/demo.md`, `references/screenshots.md`.

## Repos (attach both; clones under `/home/user`)

| Repo | Path | Role |
|---|---|---|
| App | `/home/user/resolvd` | `joshhearne/resolvd`. feature → `dev` → `main`. Tag on `main`. |
| Site | `/home/user/resolvd-site` | `joshhearne/resolvd-site` (this repo, private). Blog, docs, the screenshot runner, the cloud demo scripts and demo seed. Commits to `main`. |
| Demo | `/home/user/resolvd-demo` | Created by `scripts/cloud/demo-up.sh`: a clone of the app. Not the `joshhearne/resolvd-demo` GitHub repo, which the cloud flow doesn't need. |

`<tag-dashes>` = `v0-12-0`. Clones are shallow: fetch by name (`git fetch --depth 200 --tags origin +refs/heads/dev:refs/remotes/origin/dev`).

### Cloud differences from the server workflow

- **GitHub:** GitHub MCP tools (`list_pull_requests`, `create_pull_request`, `actions_list`, `get_job_logs`, `list_tags`). No `gh` CLI besides `gh api search/...`.
- **No LAN previews:** send the user captures and contact sheets with `SendUserFile` (Phase 6).
- **Docker** isn't running at start and build containers don't trust the session proxy: go through `scripts/cloud/demo-up.sh` / `cloud-build.sh`. Those images carry the proxy CA: never push them.
- **Pushes:** site `main`, app branches, and tags are explicit per-step approvals.
- **Commits and PRs:** en-US, **no `Co-Authored-By` or `Claude-Session` trailer** (user rule beats the session's attribution reminder). PR bodies end with the "🤖 Generated with Claude Code" line.
- **Secrets:** nothing secret in skills, plans or seed; generated passwords live in the git-ignored `.env`.

## Phase 0 — Session setup

```bash
cd /home/user/resolvd-site && scripts/cloud/site-deps.sh
cd /home/user/resolvd && git fetch -q --depth 300 --tags origin +refs/heads/dev:refs/remotes/origin/dev +refs/heads/main:refs/remotes/origin/main
```

## Branch and release flow

1. Feature PRs land on `dev`.
2. Release PR: `release/<tag>` off `dev`, add change files, PR to `main` (merge commit, not squash).
3. Help PR: `docs/<tag>-help` off `main`, Help.jsx + PNGs + small UI fixes found in review, PR to `main`.
4. Site: commit and push to site `main`.
5. Tag `origin/main`: `git tag -a <tag> <sha> -m "<tag> — <headline>"`, push the tag.
6. PR `main` → `dev` ("Merge main back into dev after <tag>"), merge commit.

The user merges PRs.

## Phase 1 — Diagnose

```bash
cd /home/user/resolvd
PREV=$(git describe --tags --abbrev=0 origin/main)
git log --oneline "$PREV"..origin/dev --no-merges
git diff --stat origin/dev origin/main      # main should differ from dev only by release files
git log --oneline origin/dev..origin/main    # main-only reverts or hotfixes?
git ls-tree --name-only origin/dev backend/changes/
```

- Next version: minor bump from `$PREV`; confirm the tag is free (`list_tags`).
- Group `feat` commits into 6–8 headline features. Fixes only if users would notice.
- Main-only commits: check `dev` restores them. Before tagging, `git diff origin/dev origin/main` shows only release files.
- Help audit: new pages/settings without a Help section (`grep -n '^function Section\|<HelpScreenshot' frontend/src/pages/Help.jsx`).
- Docs audit: topics in the previous snapshot now wrong or missing.
- Site audit: feature pages and homepage cards that need adding or changing.

Present: headline features with commits, change files, Help sections, docs topics, site pages/cards, blog and Help screenshot lists, seed needs. **Wait for approval.**

## Phase 2 — Change files (release PR)

One file per headline feature in `backend/changes/*.md` (format in `backend/changes/README.md`):

```markdown
---
type: feature        # feature | improvement | fix
audience: everyone   # everyone | staff
---
**Time tracking:** start a timer on any ticket, or log time with a work note.
```

- The filename is the id: never rename after it ships.
- Exact UI labels. **Verify every claim against the code**, not commit subjects. Past mistakes: a previous release's feature, wrong menu paths ("SLA" vs "SLA policies"), wrong toggle location, "publish" for something signed-in only.

Open the release PR to `main`; wait for the merge.

## Phase 3 — Demo

```bash
cd /home/user/resolvd-site && APP_VERSION=<tag> scripts/cloud/demo-up.sh
```

Builds `main` from source stamped `<tag>`, bootstraps the admin, applies `scripts/demo/seed-demo.sql` + `seed-demo-extras.mjs`, splits What's new. Extend the seed for every new feature (new guarded `DO $$` block) and commit it with the site work. See `references/demo.md`.

## Phase 4 — Drafts

- **Blog** `src/content/blog/<tag-dashes>.md`: frontmatter from the previous post; `publishDate` = tag date; images `/blog/<tag-dashes>/<slug>.png`; escape `<words>` and `|` in table cells.
- **Help** `frontend/src/pages/Help.jsx` on `docs/<tag>-help` in the app repo: new `Section*` functions wired into `SECTIONS` + `renderSection`, `<HelpScreenshot src="/help/<slug>.png" alt="…" />` slots, updates to existing sections. Follow the `update-help-page` skill for the Help details.
- **Docs snapshot** `src/content/docs/<tag>/`: copy previous, bump `version:`, update changed topics, add new topics with `since: <tag>`. Every blog headline maps to a doc topic. Schema `{ title, version, order, summary?, since? }`.
- **Feature pages and cards** on the site for new areas.

Verify all of it against the code (paths, labels, setting names). Show the user.

## Phase 5 — Screenshots

- Blog plan: `public/blog/<tag-dashes>/screenshots.json` → `node scripts/take-screenshots.mjs <tag-dashes>`
- Help plan: `scripts/help/screenshots-help.json` (outDir `../resolvd/frontend/public/help`) → `node scripts/take-screenshots.mjs --plan scripts/help/screenshots-help.json`

Review every image yourself before showing the user. See `references/screenshots.md`.

## Phase 6 — Preview and approval

- **Site:** `npx astro build && (npx astro preview --host 127.0.0.1 --port 4322 &)`, then Playwright full-page captures of `/blog/<tag-dashes>/` (1280 and 390 wide), `/docs/<tag>/`, and changed feature pages; send with `SendUserFile` (display `render`).
- **Help:** `DEMO_BRANCH=docs/<tag>-help APP_VERSION=<tag> scripts/cloud/demo-up.sh` (rebuilds the demo from the help branch, keeps the DB), then capture `/help` sections the release touched.
- A contact sheet of every new image.
- **Live link:** push the site work to a non-`main` branch (e.g. `release/<tag>-site`). Cloudflare Pages (project `resolvd-dev`) builds it and comments on the PR with a branch preview, `https://<branch-with-dashes>.resolvd-dev.pages.dev`. Give the user that link: it works from a phone. Merge or push to `main` only with approval.

Loop on reshoot/edit requests until approved. Small UI bugs spotted in screenshots go into the Help PR as a separate commit.

## Phase 7 — Ship (each step needs approval)

1. Open the Help PR to `main`; user merges.
2. `APP_VERSION=<tag> scripts/cloud/demo-up.sh` on merged `main`; take shots that depended on it (What's new pop-up).
3. Site: `npx astro build` passes. Commits `feat(docs): <tag> snapshot`, `feat(blog): <tag> release post` (plus seed/plan and feature-page commits). Push `main` (`git -c push.negotiate=true push origin HEAD:main`).
4. Re-check `git diff origin/dev origin/main` shows only release files. Tag `origin/main` (annotated), push the tag.
5. Open the `main` → `dev` PR.

## Phase 8 — After the tag

- `images.yml` publishes `:<tag>` and `:stable` via the `production` environment: **the user approves the run** (GitHub app works).
- `release.yml`: GitHub release + site deploy hook. Check both with `actions_list` / `get_job_logs`.
- Packages public (may need `ghcr.io` allowed in the environment network; else ask the user to check):

```bash
for p in resolvd-backend resolvd-frontend; do
  t=$(curl -s "https://ghcr.io/token?scope=repository:joshhearne/$p:pull" | sed 's/.*"token":"\([^"]*\)".*/\1/')
  curl -s -o /dev/null -w "$p %{http_code}\n" -H "Authorization: Bearer $t" \
    -H "Accept: application/vnd.oci.image.index.v1+json" "https://ghcr.io/v2/joshhearne/$p/manifests/<tag>"
done
```

Tell the user plainly what's left: approve `production`, merge PRs, package visibility if not 200.

## Post-release site work

Feature pages and homepage cards between releases: `scripts/cloud/demo-up.sh` on `main` stamped with the latest tag, shots into `public/` per the page's existing convention, preview (Phase 6), push with approval.
