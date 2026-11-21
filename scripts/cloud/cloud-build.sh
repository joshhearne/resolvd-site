#!/usr/bin/env bash
# cloud-build.sh — `docker build` that works inside a Claude Code cloud session.
#
# Build containers there can't see the session's HTTPS proxy CA, so npm/apk
# fail with SELF_SIGNED_CERT_IN_CHAIN. This copies the Dockerfile to a temp
# file, adds the CA after every FROM (via an extra build context, so nothing in
# the checkout changes), and builds with host networking.
#
#   cloud-build.sh <context> <tag> [-f Dockerfile] [extra docker build args...]
#
# The CA ends up inside the image: these images are for the local demo only.
# Never push them. Outside a cloud session (no /root/.ccr/ca-bundle.crt) it is
# a plain docker build.
set -euo pipefail
CTX="$1"; TAG="$2"; shift 2
DF="$CTX/Dockerfile"
if [[ "${1:-}" == "-f" ]]; then DF="$2"; shift 2; fi
CA="${CCR_CA_BUNDLE:-/root/.ccr/ca-bundle.crt}"
if [[ ! -f "$CA" ]]; then exec docker build -t "$TAG" -f "$DF" "$@" "$CTX"; fi
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cp "$CA" "$TMP/ca.crt"
awk '{print} /^FROM[[:space:]]/ && $2 != "scratch" {print "COPY --from=ccrca ca.crt /usr/local/share/ca-certificates/ccr-proxy.crt"; print "ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/ccr-proxy.crt"}' "$DF" > "$TMP/Dockerfile"
P="${HTTPS_PROXY:-${https_proxy:-}}"
exec docker build --network host \
  ${P:+--build-arg HTTPS_PROXY=$P --build-arg https_proxy=$P} \
  --build-context ccrca="$TMP" -f "$TMP/Dockerfile" -t "$TAG" "$@" "$CTX"
