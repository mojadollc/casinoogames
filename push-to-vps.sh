#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  push-to-vps.sh — rsync project to VPS and run deploy.sh
#  Usage:
#    ./push-to-vps.sh                  # uses default IP
#    ./push-to-vps.sh 1.2.3.4          # custom IP
#    ./push-to-vps.sh 1.2.3.4 --sync-only   # upload only, no deploy
# ─────────────────────────────────────────────────────────────
set -euo pipefail

VPS_IP="${1:-188.166.250.245}"
SYNC_ONLY=false
if [ "${2:-}" = "--sync-only" ] || [ "${1:-}" = "--sync-only" ]; then
  SYNC_ONLY=true
  if [ "${1:-}" = "--sync-only" ]; then
    VPS_IP="188.166.250.245"
  fi
fi

VPS_USER="${VPS_USER:-root}"
APP_DIR="/opt/casino-platform"
DOMAIN="${DOMAIN:-reelx.lazapee.ph}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Push to $VPS_USER@$VPS_IP:$APP_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f ".env.production" ]; then
  echo "✗ .env.production not found in project root"
  echo "  cp .env.production.example .env.production"
  echo "  nano .env.production   # set DB_PASSWORD, JWT_*, REDIS_*, DOMAIN"
  exit 1
fi

# Warn if placeholders remain
if grep -q 'CHANGE_ME' .env.production 2>/dev/null; then
  echo "⚠ WARNING: .env.production still contains CHANGE_ME placeholders"
  read -r -p "Continue anyway? [y/N] " ans
  case "$ans" in
    y|Y) ;;
    *) exit 1 ;;
  esac
fi

echo "▶ Testing SSH..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$VPS_USER@$VPS_IP" "echo ok" 2>/dev/null; then
  echo "  (BatchMode failed — you may be prompted for a password or key passphrase)"
fi

echo "▶ Syncing files..."
ssh "$VPS_USER@$VPS_IP" "mkdir -p $APP_DIR"
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='*/node_modules' \
  --exclude='frontend/build' \
  --exclude='frontend/dist' \
  --exclude='*.log' \
  --exclude='.env' \
  --exclude='backend/uploads' \
  --exclude='backend/uploads/**' \
  --exclude='uploads' \
  --exclude='uploads/**' \
  ./ "$VPS_USER@$VPS_IP:$APP_DIR/"

echo "✓ Files synced"

if [ "$SYNC_ONLY" = true ]; then
  echo "✓ Sync-only mode — skipped deploy.sh"
  exit 0
fi

echo "▶ Running deploy.sh on VPS..."
ssh -t "$VPS_USER@$VPS_IP" "chmod +x $APP_DIR/deploy.sh && bash $APP_DIR/deploy.sh"

echo ""
echo "✅ Done! Visit https://$DOMAIN"
echo "   Health: curl -s https://$DOMAIN/health"
echo "   Smoke:  API_URL=https://$DOMAIN/api node scripts/smoke-test.js"
