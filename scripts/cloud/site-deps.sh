#!/usr/bin/env bash
# site-deps.sh — npm ci for this site, then point playwright at the copy a
# Claude Code cloud session ships (its browser matches that version only).
# Safe to re-run. Outside a cloud session it just runs npm ci.
set -euo pipefail
cd "$(dirname "$0")/../.."
npm ci --no-audit --no-fund
G=/opt/node22/lib/node_modules
if [[ -d "$G/playwright" ]]; then
  for m in playwright playwright-core; do
    src="$G/$m"; [[ -d "$src" ]] || src="$G/playwright/node_modules/$m"
    if [[ -d "$src" ]]; then rm -rf "node_modules/$m"; ln -s "$src" "node_modules/$m"; fi
  done
fi
