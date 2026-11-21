#!/usr/bin/env node
// Generic Playwright screenshot taker for release blog posts.
//
// Reads ./public/blog/<tag>/screenshots.json and writes PNGs into the same folder.
//
// Usage:
//   node scripts/take-screenshots.mjs <tag>                   # take all shots
//   node scripts/take-screenshots.mjs <tag> --only foo,bar    # take only named shots (reshoot)
//   node scripts/take-screenshots.mjs <tag> --headed          # visible browser (debugging)
//   node scripts/take-screenshots.mjs --plan scripts/help/screenshots-help.json [--only a,b]
//       # any plan file; PNGs go to the plan's "outDir" (relative to this repo,
//       # e.g. "../resolvd/frontend/public/help" for the in-app Help page)
//
// Plan schema (JSON):
//   {
//     "baseURL": "http://localhost:8091",
//     "viewport": { "width": 1440, "height": 900 },
//     "auth": {                                  // optional
//       "url": "/login",
//       "steps": [
//         { "fill":   "input[name=email]",    "value": "${DEMO_EMAIL}" },
//         { "fill":   "input[name=password]", "value": "${DEMO_PASSWORD}" },
//         { "click":  "button[type=submit]" },
//         { "waitFor":"a[href='/dashboard']" }
//       ]
//     },
//     "shots": [
//       {
//         "name": "feature-1-slug",            // PNG filename minus extension
//         "url":  "/admin/email-backends",
//         "viewport": { "width": 1600, "height": 1000 },   // optional override
//         "actions": [                                      // optional
//           { "click":   ".scope-toggle" },
//           { "fill":    "input[name=q]", "value": "STRAT" },
//           { "waitFor": ".scope-list .row" },
//           { "wait":    300 }
//         ],
//         "fullPage": false,                                // optional
//         "clip": { "x":0, "y":0, "width":1440, "height":700 } // optional
//       }
//     ]
//   }
//
// ${VAR} interpolation reads from process.env. Loads website .env if present.

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { tag: null, plan: null, only: null, headed: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--only') args.only = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--headed') args.headed = true;
    else if (a === '--plan') args.plan = argv[++i];
    else if (!a.startsWith('--')) args.tag = a;
  }
  if (!args.tag && !args.plan) {
    console.error('usage: node scripts/take-screenshots.mjs <tag> | --plan <file> [--only name1,name2] [--headed]');
    process.exit(2);
  }
  return args;
}

async function loadDotenv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const txt = await readFile(envPath, 'utf8');
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

function interp(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
    if (!(name in process.env)) {
      throw new Error(`screenshots plan references env var ${name} but it isn't set (check ${join(ROOT, '.env')})`);
    }
    return process.env[name];
  });
}

async function runStep(page, step) {
  if (step.click)  { await page.click(interp(step.click)); return; }
  if (step.fill !== undefined) {
    await page.fill(interp(step.fill), interp(step.value ?? ''));
    return;
  }
  if (step.press)  { await page.keyboard.press(step.press); return; }
  if (step.waitFor) { await page.waitForSelector(interp(step.waitFor), { state: 'visible' }); return; }
  if (step.waitForURL) { await page.waitForURL(interp(step.waitForURL)); return; }
  if (step.hover)  { await page.hover(interp(step.hover)); return; }
  if (step.scrollTo) {
    await page.evaluate((sel) => {
      document.querySelector(sel)?.scrollIntoView({ block: 'center' });
    }, interp(step.scrollTo));
    return;
  }
  if (step.wait) { await page.waitForTimeout(step.wait); return; }
  if (step.eval) { await page.evaluate(step.eval); return; }
  throw new Error(`unknown step: ${JSON.stringify(step)}`);
}

async function authenticate(context, plan) {
  if (!plan.auth) return;
  const page = await context.newPage();
  await page.goto((plan.baseURL || '') + plan.auth.url);
  for (const step of plan.auth.steps || []) await runStep(page, step);
  await page.close();
}

async function takeShot(context, plan, shot) {
  const page = await context.newPage();
  const vp = shot.viewport || plan.viewport;
  if (vp) await page.setViewportSize(vp);
  // Plan-level "css" is injected into every page (e.g. to hide a pop-up),
  // unless the shot sets "planCss": false.
  if (plan.css && shot.planCss !== false) {
    await page.addInitScript((css) => {
      const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };
      if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
    }, plan.css);
  }
  const url = (plan.baseURL || '') + shot.url;
  const res = await page.goto(url, { waitUntil: 'networkidle' });
  // A 404 page can still pass the waits, so a stale url would otherwise "succeed".
  if (res && res.status() >= 400) throw new Error(`${shot.url} returned ${res.status()}`);
  for (const step of shot.actions || []) await runStep(page, step);
  if (shot.preDelay) await page.waitForTimeout(shot.preDelay);
  const outDir = plan._outDir || join(ROOT, 'public', 'blog', plan._tag);
  await mkdir(outDir, { recursive: true });
  const out = join(outDir, `${shot.name}.png`);
  const opts = { path: out };
  if (shot.fullPage) opts.fullPage = true;
  if (shot.clip) opts.clip = shot.clip;
  await page.screenshot(opts);
  await page.close();
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadDotenv();

  const planPath = args.plan ? resolve(process.cwd(), args.plan) : join(ROOT, 'public', 'blog', args.tag, 'screenshots.json');
  try { await access(planPath); }
  catch {
    console.error(`plan not found: ${planPath}`);
    process.exit(2);
  }
  const plan = JSON.parse(await readFile(planPath, 'utf8'));
  plan._tag = args.tag;
  if (args.plan) {
    if (!plan.outDir) { console.error(`${planPath} needs an "outDir"`); process.exit(2); }
    plan._outDir = resolve(ROOT, plan.outDir);
  }

  let shots = plan.shots || [];
  if (args.only) {
    const filt = new Set(args.only);
    shots = shots.filter(s => filt.has(s.name));
    const missing = [...filt].filter(n => !shots.find(s => s.name === n));
    if (missing.length) {
      console.error(`unknown shot name(s): ${missing.join(', ')}`);
      process.exit(2);
    }
  }
  if (shots.length === 0) {
    console.error('no shots to take');
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: !args.headed });
  const context = await browser.newContext({
    viewport: plan.viewport || { width: 1440, height: 900 },
    deviceScaleFactor: plan.deviceScaleFactor || 2,
  });

  const errors = [];
  try {
    await authenticate(context, plan);
    for (const shot of shots) {
      try {
        const out = await takeShot(context, plan, shot);
        console.log(`✓ ${shot.name} → ${out}`);
      } catch (e) {
        console.error(`✗ ${shot.name}: ${e.message}`);
        errors.push(shot.name);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  if (errors.length) {
    console.error(`\n${errors.length} shot(s) failed: ${errors.join(', ')}`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
