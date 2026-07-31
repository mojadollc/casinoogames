#!/bin/bash
set -e

VPS_IP="${1:-188.166.250.245}"
VPS_USER="root"
APP_DIR="/opt/casino-platform"
DOMAIN="reelx.lazapee.ph"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Pushing to $VPS_USER@$VPS_IP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Must run from the project root (where this script lives)
cd "$(dirname "$0")"

# Check .env.production exists
if [ ! -f ".env.production" ]; then
  echo "✗ .env.production not found in project root"
  exit 1
fi

# Sync files to VPS
echo "▶ Syncing files to VPS..."
ssh "$VPS_USER@$VPS_IP" "mkdir -p $APP_DIR"
rsync -avz --progress --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='*/node_modules' \
  --exclude='frontend/build' \
  --exclude='frontend/dist' \
  --exclude='*.log' \
  --exclude='.env' \
  ./ "$VPS_USER@$VPS_IP:$APP_DIR/"

echo "✓ Files synced"

# Make deploy.sh executable on VPS then run it
echo "▶ Running deploy on VPS..."
ssh "$VPS_USER@$VPS_IP" "chmod +x $APP_DIR/deploy.sh && bash $APP_DIR/deploy.sh"

echo ""
echo "✅ Done! Visit https://$DOMAIN"
