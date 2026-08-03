#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  update.sh  —  Build locally & deploy to VPS via password SSH
#  Usage:
#    ./update.sh              → frontend + backend + seed
#    ./update.sh frontend     → frontend only (fastest)
#    ./update.sh backend      → backend only
#    ./update.sh seed         → run DB seed only
# ─────────────────────────────────────────────────────────────

VPS_IP="188.166.250.245"
VPS_USER="root"
APP_DIR="/opt/casino-platform"
DOMAIN="reelx.lazapee.ph"
MODE="${1:-all}"

# Check sshpass is available (needed for password auth)
if ! command -v sshpass &>/dev/null; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ⚠  sshpass not found — install it first:"
  echo ""
  echo "     brew install hudochenkov/sshpass/sshpass"
  echo ""
  echo "  Then re-run: ./update.sh"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

# Prompt for VPS password once
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Casino Platform — Quick Update"
echo "  Mode: $MODE"
echo "  Target: $VPS_USER@$VPS_IP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -s -p "🔑 VPS root password: " VPS_PASS
echo ""
echo ""

SSH="sshpass -p $VPS_PASS ssh -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP"
SCP="sshpass -p $VPS_PASS scp -o StrictHostKeyChecking=no"

# ── Helper: run command on VPS ────────────────────────────
vps() { $SSH "$@"; }

# ── Test connection ───────────────────────────────────────
echo "▶ Testing connection..."
if ! vps "echo ok" &>/dev/null; then
  echo "✗ Cannot connect to VPS. Check password or IP."
  exit 1
fi
echo "✓ Connected"
echo ""

# ══════════════════════════════════════════════════════════
#  FRONTEND
# ══════════════════════════════════════════════════════════
deploy_frontend() {
  echo "▶ Building frontend..."
  cd "$(dirname "$0")/frontend"

  # Install deps if node_modules missing
  [ ! -d node_modules ] && npm install --silent

  VITE_API_URL="https://$DOMAIN/api" \
  VITE_SOCKET_URL="https://$DOMAIN" \
  npm run build 2>&1 | tail -5

  if [ ! -d build ]; then
    echo "✗ Build failed — check errors above"
    exit 1
  fi
  echo "✓ Frontend built"

  echo "▶ Uploading build to VPS..."
  # Remove old build on VPS first
  vps "rm -rf $APP_DIR/frontend/build"
  # Upload new build
  $SCP -r build "$VPS_USER@$VPS_IP:$APP_DIR/frontend/"
  echo "✓ Frontend uploaded"

  echo "▶ Reloading nginx..."
  vps "nginx -t && systemctl reload nginx"
  echo "✓ Nginx reloaded"
  cd - > /dev/null
}

# ══════════════════════════════════════════════════════════
#  BACKEND
# ══════════════════════════════════════════════════════════
deploy_backend() {
  echo "▶ Uploading backend source files..."
  cd "$(dirname "$0")"

  # Upload changed backend files (excludes node_modules)
  $SCP -r backend/games     "$VPS_USER@$VPS_IP:$APP_DIR/backend/"
  $SCP -r backend/reporting "$VPS_USER@$VPS_IP:$APP_DIR/backend/"
  $SCP    backend/server.js "$VPS_USER@$VPS_IP:$APP_DIR/backend/"
  echo "✓ Backend files uploaded"

  echo "▶ Restarting backend (PM2)..."
  vps "cd $APP_DIR/backend && npm install --production --silent && pm2 reload casino-backend --update-env"
  echo "✓ Backend restarted"
  cd - > /dev/null
}

# ══════════════════════════════════════════════════════════
#  SEED
# ══════════════════════════════════════════════════════════
deploy_seed() {
  echo "▶ Uploading seed files..."
  $SCP database/seeders/seed-games.js "$VPS_USER@$VPS_IP:$APP_DIR/database/seeders/"
  $SCP database/seeders/seed.js       "$VPS_USER@$VPS_IP:$APP_DIR/database/seeders/"

  echo "▶ Running seed on VPS..."
  vps "cd $APP_DIR/database && node seeders/seed-games.js"
  echo "✓ Seed complete"
}

# ══════════════════════════════════════════════════════════
#  HEALTH CHECK
# ══════════════════════════════════════════════════════════
health_check() {
  echo ""
  echo "▶ Health check..."
  sleep 2
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "https://$DOMAIN/health" 2>/dev/null || curl -sf -o /dev/null -w "%{http_code}" "http://$DOMAIN/health" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "✓ Site is live (HTTP 200)"
  else
    echo "⚠ Health check returned HTTP $STATUS"
    echo "  Check logs: ssh root@$VPS_IP 'pm2 logs casino-backend --lines 30'"
  fi
}

# ══════════════════════════════════════════════════════════
#  RUN BASED ON MODE
# ══════════════════════════════════════════════════════════
case "$MODE" in
  frontend)
    deploy_frontend
    ;;
  backend)
    deploy_backend
    ;;
  seed)
    deploy_seed
    ;;
  all)
    deploy_frontend
    echo ""
    deploy_backend
    echo ""
    deploy_seed
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Usage: ./update.sh [frontend|backend|seed|all]"
    exit 1
    ;;
esac

health_check

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Update complete!"
echo "  🌐 https://$DOMAIN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
