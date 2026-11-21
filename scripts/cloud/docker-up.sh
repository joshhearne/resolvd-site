#!/usr/bin/env bash
# docker-up.sh — start the Docker daemon in a cloud session if it isn't running.
set -euo pipefail
docker info >/dev/null 2>&1 && exit 0
SUDO=""; [[ $EUID -ne 0 ]] && SUDO="sudo"
$SUDO sh -c 'nohup dockerd >/var/log/dockerd.log 2>&1 &'
for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && exit 0; sleep 1; done
echo "dockerd did not start; see /var/log/dockerd.log" >&2; exit 1
