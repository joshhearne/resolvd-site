import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { featureNav } from "../lib/featureNav";
import { getLatestVersion, listTopics, topicSlug } from "../lib/docs";

// Generated at build time so the docs + blog lists track each release
// without hand edits. Served as text/markdown via public/_headers.
const SITE = "https://resolvd.dev";

export const GET: APIRoute = async () => {
  const version = await getLatestVersion();
  const topics = await listTopics(version);
  const posts = (await getCollection("blog"))
    .filter(p => !p.data.draft)
    .sort((a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime())
    .slice(0, 6);

  const lines: string[] = [
    "# Resolvd",
    "",
    "> Source-available, self-hosted ticket and project tracker for IT teams and MSPs.",
    "> Ticketing with SLA clocks, on-call and breach webhooks, time tracking and MSP billing,",
    "> inventory (Action1), alerts (Zabbix, Uptime Kuma, webhooks), status pages, email-to-ticket,",
    "> a built-in KB or Trove KB, and bring-your-own-key AI. Runs on Docker; your server, your data.",
    "",
    `- Latest release: ${version}`,
    "- License: FSL-1.1 (source-available)",
    "- Source: https://github.com/joshhearne/resolvd",
    "- Hosting: self-host only; there is no hosted/SaaS plan.",
    "",
    "## Features",
    "",
    ...featureNav.map(f => `- [${f.label}](${SITE}${f.href}): ${f.note}`),
    "",
    "## Get started",
    "",
    `- [Install](${SITE}/install/): Install wizard that generates .env, docker-compose.yml and a reverse-proxy snippet`,
    `- [Manual setup](${SITE}/manual/): Step-by-step setup without the wizard, with branching choices for each component`,
    `- [License](${SITE}/license/): FSL-1.1 terms in plain language`,
    `- [Privacy](${SITE}/privacy/): What the site collects; the self-hosted software sends no telemetry`,
    `- [Terms](${SITE}/terms/): Terms of use for this website`,
    "",
    `## Docs (${version})`,
    "",
    ...topics.map(t => {
      const summary = t.data.summary ? `: ${t.data.summary}` : "";
      return `- [${t.data.title}](${SITE}/docs/${version}/${topicSlug(t)}/)${summary}`;
    }),
    "",
    "## Release notes",
    "",
    ...posts.map(p => `- [${p.data.title}](${SITE}/blog/${p.id}/): ${p.data.summary}`),
    `- [Full changelog](${SITE}/changelog/)`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
