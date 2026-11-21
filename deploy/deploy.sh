#!/usr/bin/env bash
# XMusic production deploy. Runs on the VPS as the `deploy` user.
# GitHub Actions triggers it over SSH with a key that can only run this script.
# Install it outside the repo so a push can't change what that key runs:
#   install -m 750 deploy/deploy.sh /var/www/shared/scripts/deploy-xmusic.sh
set -euo pipefail

APP_DIR=/var/www/apps/XMusic
BRANCH=main
PM2_APP=xmusic-api
HEALTH_URL="http://127.0.0.1:3000/socket.io/?EIO=4&transport=polling"
LOG=/var/www/logs/xmusic/deploy.log

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# Only one deploy at a time
exec 9>/tmp/deploy-xmusic.lock
flock -n 9 || { echo "Another deploy is running"; exit 1; }

exec > >(tee -a "$LOG") 2>&1
echo "=== Deploy started $(date -Is) ==="

cd "$APP_DIR"

# Refuse to deploy over local edits to tracked files
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: local changes in $APP_DIR; fix them first (git status)"
  exit 1
fi

git fetch --prune origin "$BRANCH"
git checkout -q "$BRANCH"
git merge --ff-only "origin/$BRANCH"
echo "Now at: $(git log -1 --oneline)"

(cd server && npm ci --no-audit --no-fund)
(cd client && npm ci --no-audit --no-fund && npm run build)

pm2 restart "$PM2_APP"
pm2 save >/dev/null

# Health check: up to 30 seconds for the API to answer
for i in $(seq 1 15); do
  if curl -fsS -m 3 "$HEALTH_URL" | grep -q '"sid"'; then
    echo "Health check OK"
    echo "=== Deploy finished $(date -Is) ==="
    exit 0
  fi
  sleep 2
done

echo "ERROR: health check failed. Recent logs:"
pm2 logs "$PM2_APP" --lines 30 --nostream || true
exit 1