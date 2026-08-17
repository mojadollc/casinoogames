#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  deploy-vps.sh  —  ONE script to deploy updates to your VPS
#
#  Usage:
#    ./deploy-vps.sh                    # auto-detect changes
#    ./deploy-vps.sh all                # force full deploy
#    ./deploy-vps.sh frontend           # frontend only
#    ./deploy-vps.sh backend            # backend + game-engine
#    ./deploy-vps.sh database           # migrations + seed
#    ./deploy-vps.sh 1.2.3.4            # custom VPS IP
#    ./deploy-vps.sh 1.2.3.4 all        # custom IP + full deploy
#
#  Password SSH (if no key):
#    VPS_PASS='yourpassword' ./deploy-vps.sh all
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

VPS_IP="${VPS_IP:-188.166.250.245}"
VPS_USER="${VPS_USER:-root}"
APP_DIR="${APP_DIR:-/opt/casino-platform}"
DOMAIN="${DOMAIN:-reelx.lazapee.ph}"
MODE="auto"

for arg in "${@:-}"; do
  if [[ "$arg" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    VPS_IP="$arg"
  elif [[ "$arg" =~ ^(auto|all|frontend|backend|database|fe|be|db)$ ]]; then
    case "$arg" in
      fe) MODE="frontend" ;;
      be) MODE="backend" ;;
      db) MODE="database" ;;
      *)  MODE="$arg" ;;
    esac
  elif [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
    sed -n '2,16p' "$0"
    exit 0
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Casino Platform — Deploy to VPS"
echo "  Target : ${VPS_USER}@${VPS_IP}:${APP_DIR}"
echo "  Domain : ${DOMAIN}"
echo "  Mode   : ${MODE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

command -v rsync >/dev/null || { echo "✗ rsync required"; exit 1; }
command -v ssh   >/dev/null || { echo "✗ ssh required"; exit 1; }

if [ ! -f "$ROOT/.env.production" ]; then
  echo "✗ .env.production missing"
  echo "  cp .env.production.example .env.production"
  echo "  nano .env.production"
  exit 1
fi

if grep -q 'CHANGE_ME' "$ROOT/.env.production" 2>/dev/null; then
  echo "⚠ .env.production still has CHANGE_ME placeholders"
  read -r -p "Continue anyway? [y/N] " ans || true
  [[ "${ans:-}" =~ ^[yY]$ ]] || exit 1
fi

ssh_cmd() {
  if [ -n "${VPS_PASS:-}" ] && command -v sshpass >/dev/null 2>&1; then
    sshpass -p "$VPS_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 "$VPS_USER@$VPS_IP" "$@"
  else
    ssh -o ConnectTimeout=15 "$VPS_USER@$VPS_IP" "$@"
  fi
}

rsync_cmd() {
  if [ -n "${VPS_PASS:-}" ] && command -v sshpass >/dev/null 2>&1; then
    sshpass -p "$VPS_PASS" rsync -e "ssh -o StrictHostKeyChecking=no" "$@"
  else
    rsync -e "ssh -o ConnectTimeout=15" "$@"
  fi
}

echo "▶ Testing SSH..."
if ! ssh_cmd "echo ok" >/dev/null 2>&1; then
  echo "  SSH key auth failed."
  if [ -z "${VPS_PASS:-}" ] && command -v sshpass >/dev/null 2>&1; then
    read -r -s -p "🔑 VPS password: " VPS_PASS
    echo ""
    export VPS_PASS
  fi
  ssh_cmd "echo ok" >/dev/null || {
    echo "✗ Cannot connect to ${VPS_USER}@${VPS_IP}"
    echo "  Try: ssh-copy-id ${VPS_USER}@${VPS_IP}"
    echo "  Or:  VPS_PASS='password' ./deploy-vps.sh"
    exit 1
  }
fi
echo "✓ Connected"

# ── Detect what to deploy ────────────────────────────────────
NEED_FE=false
NEED_BE=false
NEED_DB=false

case "$MODE" in
  all)      NEED_FE=true; NEED_BE=true; NEED_DB=true ;;
  frontend) NEED_FE=true ;;
  backend)  NEED_BE=true ;;
  database) NEED_DB=true ;;
  *)
    # auto: git changes, else full
    if [ -d "$ROOT/.git" ] && command -v git >/dev/null 2>&1; then
      FILES="$(git status --porcelain 2>/dev/null | awk '{print $NF}')"
      if [ -z "$(echo "$FILES" | tr -d '[:space:]')" ]; then
        # no uncommitted changes — deploy all (safe after pull/edit)
        NEED_FE=true; NEED_BE=true; NEED_DB=true
      else
        while IFS= read -r f; do
          [ -z "$f" ] && continue
          case "$f" in
            frontend/*)              NEED_FE=true ;;
            backend/*|game-engine/*) NEED_BE=true ;;
            database/*)              NEED_DB=true ;;
            *)                       NEED_FE=true; NEED_BE=true ;;
          esac
        done <<< "$FILES"
      fi
    else
      NEED_FE=true; NEED_BE=true; NEED_DB=true
    fi
    ;;
esac

echo ""
echo "▶ Plan:"
$NEED_FE && echo "   • Frontend  (build)"
$NEED_BE && echo "   • Backend   (deps + PM2 restart)"
$NEED_DB && echo "   • Database  (migrations + seed)"
echo ""

# ── Sync files ───────────────────────────────────────────────
echo "▶ Syncing project to VPS..."
ssh_cmd "mkdir -p $APP_DIR"
rsync_cmd -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='*/node_modules' \
  --exclude='frontend/build' \
  --exclude='frontend/dist' \
  --exclude='*.log' \
  --exclude='.env' \
  --exclude='backend/uploads/*' \
  --exclude='coverage' \
  "$ROOT/" "$VPS_USER@$VPS_IP:$APP_DIR/"
rsync_cmd -az "$ROOT/.env.production" "$VPS_USER@$VPS_IP:$APP_DIR/.env.production"
echo "✓ Files synced"

PORT="$(grep -E '^PORT=' "$ROOT/.env.production" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
PORT="${PORT:-3020}"

# ── Database ─────────────────────────────────────────────────
if [ "$NEED_DB" = true ]; then
  echo "▶ Database migrations & seed..."
  ssh_cmd "bash -s" << REMOTE_DB
set -e
cd $APP_DIR/database
npm install --omit=dev --silent 2>/dev/null || npm install --omit=dev
for f in migrations/00*.js; do
  echo "  migrate \$f"
  node "\$f" && echo "    ok" || echo "    skip"
done
node seeders/seed.js 2>/dev/null && echo "  seed ok" || true
node seeders/seed-games.js 2>/dev/null && echo "  seed-games ok" || true
REMOTE_DB
  echo "✓ Database updated"
fi

# ── Backend ──────────────────────────────────────────────────
if [ "$NEED_BE" = true ]; then
  echo "▶ Backend deps + PM2 restart..."
  ssh_cmd "bash -s" << REMOTE_BE
set -e
cd $APP_DIR/backend
mkdir -p uploads/thumbnails
npm install --omit=dev --silent 2>/dev/null || npm install --omit=dev
cat > $APP_DIR/ecosystem.config.cjs << 'ECO'
module.exports = {
  apps: [{
    name: 'casino-backend',
    cwd: '$APP_DIR/backend',
    script: 'server.js',
    instances: 1,
    max_memory_restart: '512M',
    restart_delay: 3000,
    env: { NODE_ENV: 'production' },
  }],
};
ECO
if pm2 describe casino-backend >/dev/null 2>&1; then
  pm2 reload $APP_DIR/ecosystem.config.cjs --update-env || pm2 restart casino-backend --update-env
else
  pm2 start $APP_DIR/ecosystem.config.cjs
fi
pm2 save
REMOTE_BE
  echo "✓ Backend restarted"
fi

# ── Frontend ─────────────────────────────────────────────────
if [ "$NEED_FE" = true ]; then
  echo "▶ Building frontend on VPS..."
  ssh_cmd "bash -s" << REMOTE_FE
set -e
cd $APP_DIR/frontend
npm install --silent 2>/dev/null || npm install
VITE_API_URL="https://$DOMAIN/api" \
VITE_SOCKET_URL="https://$DOMAIN" \
npm run build
test -d build
nginx -t && systemctl reload nginx 2>/dev/null || true
REMOTE_FE
  echo "✓ Frontend built"
fi

# ── Health ───────────────────────────────────────────────────
echo "▶ Health check..."
sleep 3
STATUS="$(ssh_cmd "curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:${PORT}/health" 2>/dev/null || echo 000)"
if [ "$STATUS" = "200" ]; then
  echo "✓ Backend healthy (HTTP 200)"
else
  echo "⚠ Health HTTP $STATUS — check: ssh ${VPS_USER}@${VPS_IP} 'pm2 logs casino-backend --lines 40'"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deploy finished → https://${DOMAIN}"
echo "  🔧 Admin: https://${DOMAIN}/admin"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
