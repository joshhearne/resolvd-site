# Screenshots (cloud)

## Runner (`scripts/take-screenshots.mjs`, this repo)

| Set | Command | Plan |
|---|---|---|
| Blog | `node scripts/take-screenshots.mjs <tag-dashes> [--only a,b]` | `public/blog/<tag-dashes>/screenshots.json` (PNGs beside it) |
| Help | `node scripts/take-screenshots.mjs --plan scripts/help/screenshots-help.json [--only a,b]` | `outDir: "../resolvd/frontend/public/help"` |
| Feature pages | `--plan` with an `outDir` under `public/` | per page |

Both target `http://localhost:8091`, 1440×900, `deviceScaleFactor: 2`. Steps: `click`, `fill`, `press`, `waitFor`, `waitForURL`, `hover`, `scrollTo`, `wait`, `eval`. Per shot: `clip`, `fullPage`, `viewport`. Plan-level `css` is injected into every page (`"planCss": false` opts a shot out). A page answering ≥400 fails the shot.

IDs: a fresh seed inserts in file order, so numeric ids are stable across cloud runs as long as the seed only appends. If a shot depends on a record created by `seed-demo-extras.mjs` or by UI, navigate by clicking its name instead of hard-coding the id.

## Auth block (both plans)

```json
{ "fill": "input[type=email]", "value": "${DEMO_EMAIL}" },
{ "fill": "input[type=password]", "value": "${DEMO_PASSWORD}" },
{ "wait": 1100 }, { "press": "Enter" }, { "waitForURL": "**/dashboard" },
{ "eval": "fetch('/api/whats-new/unseen').then(r => r.json()).then(d => Promise.all((d.releases || []).map(x => fetch('/api/whats-new/seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ release_id: x.id }) }))))" },
{ "wait": 300 }
```

The login form scores bot signals: keep the dwell. Inputs have no `name`; two submit buttons exist, so press Enter.

## Recipes

React-controlled `<select>`:

```js
(() => { const s = [...document.querySelectorAll('select')].find(el => [...el.options].some(o => o.text.trim() === "Any status")); if (!s) return; const o = [...s.options].find(o => o.text.trim() === "Any status"); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); })()
```

Heading below the sticky header:

```js
(() => { const h = [...document.querySelectorAll('h2')].find(h => h.textContent.trim().startsWith('Business hours')); if (h) { h.scrollIntoView({ block: 'start' }); window.scrollBy(0, -96); } })()
```

What's new pop-up: `window.dispatchEvent(new CustomEvent("resolvd:whats-new", { detail: { releaseId: N } }))` then `{ "waitFor": "[role=dialog] h3" }`. Take it after the Help PR merges and the demo is rebuilt and stamped.

Impersonation (`POST /api/impersonate/<userId>`) switches the session for the rest of the run: keep that shot **last**, and mark releases seen for that user too.

Tabs and filters: click the tab, wait for content, pick filters that show data. Dashboard filters persist in localStorage.

Wide tables: widen the shot's `viewport` (e.g. 1720×1000).

## Review every image before the user sees it

Contact sheet (HTML grid of `<img src="file://…">` screenshotted with Playwright), then Read it; compare with `git show HEAD:<png>` for regressions. Check for:
- empty tabs/lists, unselected dropdowns, spinners
- headings under the sticky header
- What's new pop-up or toasts covering content
- "User #N" placeholders
- secrets (calendar feed URLs, API keys, webhook URLs): revoke in the demo and reshoot
- wrong customer names (Acme Corp) or real-looking personal data
- UI bugs (labels, overflow): fix in the Help PR
