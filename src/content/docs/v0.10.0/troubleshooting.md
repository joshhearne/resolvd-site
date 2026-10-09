---
title: Troubleshooting
version: v0.10.0
order: 40
summary: Cookie / redirect loops, Entra AADSTS50011, 413 Request Entity Too Large.
---

## Cookies aren't being set / login redirects loop

Almost always a TLS / proxy header issue. Make sure your proxy forwards `X-Forwarded-Proto` and that `COOKIE_SECURE=true` matches whether you're actually serving HTTPS.

## Entra login fails with AADSTS50011

Redirect URI in your App Registration doesn't exactly match `AZURE_REDIRECT_URI`. Check trailing slashes and protocol.

## 413 Request Entity Too Large on attachments

Bump `client_max_body_size` (nginx) or `max_size` (Caddy) to at least `MAX_UPLOAD_MB`.

## Action1 alert pull returns 502 / 403

Most common: the API URL field has a curl example pasted into it (Client Secret embedded). The mapper strips trailing paths but anything before `https://` confuses parsing. **API URL** should be just `https://app.action1.com` (or regional equivalent: `app.eu.action1.com`, `app.au.action1.com`).

If the URL is clean and you still see 403, the API client's role may be too restrictive. Action1 Enterprise Viewer covers all read endpoints used here (organizations, policies, endpoints/managed, apps). Enterprise Manager additionally allows remediation actions if you wire those later.

If you see `HTTP 403 on /api/3.0/{org}/alerts` specifically — Action1 doesn't expose alerts via REST at all. Resolvd polls `policies/instances/{org}/{policy}/endpoint_results` instead. Make sure the source is on a recent build.

## Action1 software sync shows 0 packages

Two possible causes:

1. Endpoint hasn't reported software to Action1 yet (newly-onboarded asset). Wait an Action1 sync cycle then re-sync.
2. Asset isn't a computer-type (Workstation / Server / Laptop). Sync is intentionally scoped to those — printers / monitors / VoIP phones skip.

## Action1 endpoint reports user but matcher doesn't link

UPN matcher refuses to guess on ambiguous matches. If the Action1 username is too short (< 3 chars after normalization) or matches multiple Resolvd users via different aliases, the asset stays unlinked. Fix manually: Inventory → asset detail → Edit → set linked user.

## Asset linking picker on a ticket is empty

The project either doesn't have `allow_asset_linking` enabled, or has an `asset_company_ids` filter that excludes every asset's company. Check **Admin → Projects → Settings** for both flags.

## SLA escalation step doesn't fire

Verify:

- The step is `enabled = TRUE`.
- The step's `priority_op` + `priority` match the ticket's effective priority.
- The trigger has actually fired (look at the ticket's `sla_response_warned_at` / `sla_response_breached_at` / etc.).
- `NOW() - trigger_at >= delay_minutes` minutes.
- The step's ID isn't already in `tickets.escalation_steps_fired` (one-shot semantics).

## Business hours seem off

The clock uses the timezone on the policy row (not the user's browser tz). Edit the policy under **Admin → SLA policies → Business hours** to match the customer site's local time.
