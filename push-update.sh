#!/bin/bash
set -e

VPS_IP="${1:-188.166.250.245}"
VPS_USER="root"
APP_DIR="/opt/casino-platform"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Smart Update → $VPS_USER@$VPS_IP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$(dirname "$0")"

# ── Detect what changed since last git commit ─────────────
CHANGED=$(git diff --name-only HEAD 2>/dev/null || git status --short | awk '{print $2}')

if [ -z "$CHANGED" ]; then
  echo "⚠  No uncommitted changes detected."
  echo "   If you already committed, comparing last 2 commits..."
  CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")
fi

echo ""
echo "Changed files:"
echo "$CHANGED" | sed 's/^/  • /'
echo ""

# ── Determine what needs to run ───────────────────────────
SYNC_BACKEND=false
SYNC_FRONTEND=false
SYNC_GAMEENGINE=false
RUN_MIGRATIONS=false
RUN_NPM_INSTALL=false
REBUILD_FRONTEND=false

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    backend/*)          SYNC_BACKEND=true ;;
    game-engine/*)      SYNC_GAMEENGINE=true; SYNC_BACKEND=true ;;
    frontend/src/*|frontend/public/*|frontend/index.html|frontend/vite.config.js)
                        SYNC_FRONTEND=true; REBUILD_FRONTEND=true ;;
    frontend/package.json|frontend/package-lock.json)
                        SYNC_FRONTEND=true; REBUILD_FRONTEND=true; RUN_NPM_INSTALL=true ;;
    backend/package.json|backend/package-lock.json)
                        SYNC_BACKEND=true; RUN_NPM_INSTALL=true ;;
    database/migrations/*)
                        SYNC_BACKEND=true; RUN_MIGRATIONS=true ;;
  esac
done <<< "$CHANGED"

# Nothing relevant changed
if ! $SYNC_BACKEND && ! $SYNC_FRONTEND && ! $SYNC_GAMEENGINE; then
  echo "✓ No backend/frontend/game-engine changes. Nothing to deploy."
  exit 0
fi

echo "Plan:"
$SYNC_BACKEND    && echo "  ✔ Sync backend"
$SYNC_GAMEENGINE && echo "  ✔ Sync game-engine"
$SYNC_FRONTEND   && echo "  ✔ Sync frontend"
$RUN_NPM_INSTALL && echo "  ✔ npm install"
$RUN_MIGRATIONS  && echo "  ✔ Run new migrations"
$REBUILD_FRONTEND && echo "  ✔ Rebuild frontend"
($SYNC_BACKEND || $SYNC_GAMEENGINE) && echo "  ✔ pm2 reload backend"
echo ""

# ── Sync only what changed ────────────────────────────────
if $SYNC_BACKEND || $SYNC_GAMEENGINE; then
  echo "▶ Syncing backend + game-engine..."
  rsync -az --delete \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='uploads/thumbnails/*' \
    ./backend/ "$VPS_USER@$VPS_IP:$APP_DIR/backend/"
  rsync -az --delete \
    ./game-engine/ "$VPS_USER@$VPS_IP:$APP_DIR/game-engine/"
  echo "✓ Backend synced"
fi

if $SYNC_FRONTEND && ! $REBUILD_FRONTEND; then
  echo "▶ Syncing frontend source..."
  rsync -az --delete \
    --exclude='node_modules' \
    --exclude='build' \
    --exclude='dist' \
    ./frontend/ "$VPS_USER@$VPS_IP:$APP_DIR/frontend/"
  echo "✓ Frontend source synced"
fi

if $REBUILD_FRONTEND; then
  echo "▶ Syncing frontend source for rebuild..."
  rsync -az --delete \
    --exclude='node_modules' \
    --exclude='build' \
    --exclude='dist' \
    ./frontend/ "$VPS_USER@$VPS_IP:$APP_DIR/frontend/"
fi

# ── Remote commands ───────────────────────────────────────
REMOTE_CMD=""

if $RUN_NPM_INSTALL; then
  if $SYNC_BACKEND; then
    REMOTE_CMD+="echo '▶ npm install (backend)...' && cd $APP_DIR/backend && npm install --production && echo '✓ done';"
  fi
  if $REBUILD_FRONTEND; then
    REMOTE_CMD+="echo '▶ npm install (frontend)...' && cd $APP_DIR/frontend && npm install && echo '✓ done';"
  fi
fi

if $RUN_MIGRATIONS; then
  # Only run migration files that were in the changed list
  while IFS= read -r file; do
    if [[ "$file" == database/migrations/*.js ]]; then
      MIGRATION=$(basename "$file")
      REMOTE_CMD+="echo '▶ Migration: $MIGRATION' && cd $APP_DIR/database && node migrations/$MIGRATION && echo '✓ done' || echo '  (skipped)';"
    fi
  done <<< "$CHANGED"
fi

if $REBUILD_FRONTEND; then
  REMOTE_CMD+="echo '▶ Building frontend...' && cd $APP_DIR/frontend && VITE_API_URL=https://reelx.lazapee.ph/api VITE_SOCKET_URL=https://reelx.lazapee.ph npm run build && echo '✓ Frontend built';"
fi

if $SYNC_BACKEND || $SYNC_GAMEENGINE; then
  REMOTE_CMD+="echo '▶ Reloading backend...' && pm2 reload casino-backend --update-env && echo '✓ Backend reloaded';"
fi

# Health check
REMOTE_CMD+="sleep 3 && STATUS=\$(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:\${PORT:-3020}/health 2>/dev/null || echo '000') && echo \"Health: HTTP \$STATUS\" && [ \"\$STATUS\" = '200' ] && echo '✓ Healthy' || echo '⚠ Check: pm2 logs casino-backend';"

if [ -n "$REMOTE_CMD" ]; then
  ssh "$VPS_USER@$VPS_IP" "
    export \$(grep -v '^#' $APP_DIR/.env.production | xargs 2>/dev/null)
    $REMOTE_CMD
  "
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Update complete! https://reelx.lazapee.ph"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
