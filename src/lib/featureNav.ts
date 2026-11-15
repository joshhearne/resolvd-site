export type FeatureNavEntry = {
  href: string;
  label: string;
  note: string;
};

export const featureNav: FeatureNavEntry[] = [
  { href: "/inventory/",   label: "Inventory + Action1", note: "Assets, software, security posture, labels, custody" },
  { href: "/consumables/", label: "Consumables",         note: "Supply ledger — toner, drums, batteries" },
  { href: "/kb/",          label: "Knowledge Base",      note: "Built-in per-project KB, optional Trove KB integration" },
  { href: "/alerts/",      label: "Alerts + Rules",      note: "Dedup, rule-driven ticket promotion" },
  { href: "/sla/",         label: "SLA Tracker",         note: "Clocks, on-call, holidays, breach webhooks" },
  { href: "/time-billing/", label: "Time + Billing",     note: "Ticket timers, rate cards, contracts, prepaid blocks" },
  { href: "/status-pages/", label: "Status Pages",       note: "Uptime Kuma services, maintenance windows" },
  { href: "/ai/",          label: "AI Assist",           note: "BYO-AI text rewrite" },
  { href: "/email/",       label: "Email-to-Ticket",     note: "Inbound pipeline + queue" },
  { href: "/vendors/",     label: "Vendor CRM",          note: "Companies, contacts, color-coded threads" },
  { href: "/integrations/", label: "Integrations",       note: "Trove KB, Action1, Zabbix, Uptime Kuma, Slack/Teams/PagerDuty, M365, Gmail" },
];

export const featurePrefixes = featureNav.map(f => f.href);

export function nextFeature(currentHref: string): FeatureNavEntry {
  const idx = featureNav.findIndex(f => f.href === currentHref);
  if (idx === -1) return featureNav[0];
  return featureNav[(idx + 1) % featureNav.length];
}
