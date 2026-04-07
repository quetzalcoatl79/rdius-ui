#!/bin/sh
# Warm-up script: pre-compiles all routes after Next.js dev server is ready
# This eliminates the first-visit compilation latency for users

set -e

echo "[warmup] waiting for Next.js dev server to be ready..."
until wget -q -O /dev/null http://localhost:3000/ 2>/dev/null; do
  sleep 1
done
echo "[warmup] dev server ready, pre-compiling routes..."

# All public routes that should be pre-compiled
ROUTES="
/
/login
/users
/users/new
/groups
/groups/new
/nas
/nas/new
/logs
/logs/postauth
/logs/sessions
/servers
/audit
/settings
/guide
"

for route in $ROUTES; do
  printf "[warmup] %-30s " "$route"
  start=$(date +%s)
  wget -q -O /dev/null "http://localhost:3000$route" 2>/dev/null && {
    end=$(date +%s)
    echo "ok ($((end - start))s)"
  } || echo "fail"
done

echo "[warmup] done — all routes compiled"
