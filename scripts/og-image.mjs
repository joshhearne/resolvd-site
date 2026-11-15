// Renders public/og-image.png (1200x630), the link-preview card for resolvd.dev.
// Run: node scripts/og-image.mjs
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const icon = await readFile(new URL("../public/icon.svg", import.meta.url), "utf8");

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet" />
<style>
  * { margin: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    font-family: "Inter", sans-serif;
    color: #e2e8f0;
    background:
      radial-gradient(700px 420px at 100% 100%, rgba(34, 197, 94, 0.10), transparent 70%),
      radial-gradient(700px 400px at 0% 0%, rgba(56, 189, 248, 0.06), transparent 70%),
      linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px) 0 0 / 40px 40px,
      linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px) 0 0 / 40px 40px,
      #0a0f1c;
    padding: 80px;
    display: flex;
    flex-direction: column;
  }
  .brand { display: flex; align-items: center; gap: 22px; }
  .brand svg { width: 72px; height: 72px; display: block; border-radius: 14px; box-shadow: 0 0 0 1.5px #334155, 0 0 40px rgba(34, 197, 94, 0.18); }
  .brand span { font-size: 40px; font-weight: 700; letter-spacing: -0.02em; color: #fff; }
  h1 {
    margin-top: 64px;
    font-size: 88px;
    font-weight: 800;
    line-height: 1.02;
    letter-spacing: -0.035em;
    color: #f1f5f9;
  }
  h1 em { font-style: normal; color: #22c55e; }
  p {
    margin-top: 36px;
    max-width: 1000px;
    font-size: 26px;
    line-height: 1.45;
    color: #94a3b8;
  }
  .url {
    margin-top: auto;
    font-family: "JetBrains Mono", monospace;
    font-size: 20px;
    color: #64748b;
  }
</style>
</head>
<body>
  <div class="brand">${icon}<span>Resolvd</span></div>
  <h1>Issue tracking that <em>stays yours</em>.</h1>
  <p>Self-hosted tickets, SLAs, alerts, and time billing for IT teams and MSPs. A lightweight Jira alternative. Source-available. One docker compose up.</p>
  <div class="url">resolvd.dev</div>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: new URL("../public/og-image.png", import.meta.url).pathname });
await browser.close();
console.log("wrote public/og-image.png");
