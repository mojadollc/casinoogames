#!/bin/bash
set -euo pipefail

DOMAIN="${DOMAIN:-reelx.lazapee.ph}"
APP_DIR="${APP_DIR:-/opt/casino-platform}"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Casino Platform — Production Deploy"
echo "  Domain: $DOMAIN"
echo "  App dir: $APP_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Must run on Linux VPS, not Mac
if [[ "$(uname)" == "Darwin" ]]; then
  echo ""
  echo "❌ This script must run ON your VPS, not your Mac."
  echo ""
  echo "   From your Mac, run instead:"
  echo "   ./push-to-vps.sh [VPS_IP]"
  echo ""
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "❌ Run as root (sudo bash deploy.sh)"
  exit 1
fi

# Sync this repo into APP_DIR if deploying from a cloned path elsewhere
if [ "$REPO_DIR" != "$APP_DIR" ] && [ -f "$REPO_DIR/backend/server.js" ]; then
  echo "▶ Syncing code into $APP_DIR ..."
  mkdir -p "$APP_DIR"
  rsync -a --delete \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='*/node_modules' \
    --exclude='frontend/build' \
    --exclude='*.log' \
    "$REPO_DIR/" "$APP_DIR/"
fi

# ── 1. System packages ────────────────────────────────────
echo "▶ Installing system packages..."
rm -f /etc/apt/sources.list.d/nodesource*.list 2>/dev/null || true
apt-get update -qq || true
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  curl git ufw nginx certbot python3-certbot-nginx ca-certificates gnupg rsync || true

if ! command -v node &>/dev/null; then
  echo "▶ Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi
echo "  Node $(node -v)  npm $(npm -v)"

if ! command -v pm2 &>/dev/null; then
  echo "▶ Installing PM2..."
  npm install -g pm2
fi

if ! command -v mysql &>/dev/null; then
  echo "▶ Installing MySQL..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
  systemctl enable mysql
  systemctl start mysql
fi

if ! command -v redis-cli &>/dev/null; then
  echo "▶ Installing Redis..."
  DEBIAN_FRONTEND=noninteractive apt-get install -y redis-server
  systemctl enable redis-server
  systemctl start redis-server
fi
echo "✓ System packages ready"

# ── 2. Firewall ───────────────────────────────────────────
echo "▶ Configuring firewall..."
ufw --force reset >/dev/null 2>&1 || true
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "✓ Firewall configured (22/80/443)"

# ── 3. Load env ───────────────────────────────────────────
if [ ! -f "$APP_DIR/.env.production" ]; then
  if [ -f "$APP_DIR/.env.production.example" ]; then
    echo "✗ ERROR: $APP_DIR/.env.production not found"
    echo "  Copy the example and edit secrets:"
    echo "    cp $APP_DIR/.env.production.example $APP_DIR/.env.production"
    echo "    nano $APP_DIR/.env.production"
  else
    echo "✗ ERROR: $APP_DIR/.env.production not found"
  fi
  exit 1
fi

# Safe export (ignore comments/blank lines; skip invalid keys)
set -a
# shellcheck disable=SC1090
source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$APP_DIR/.env.production" | sed 's/\r$//')
set +a

PORT="${PORT:-3020}"
DB_NAME="${DB_NAME:-casino_platform}"
DB_USER="${DB_USER:-casino}"
DB_PASSWORD="${DB_PASSWORD:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
DOMAIN="${DOMAIN:-reelx.lazapee.ph}"

if [ -z "${JWT_SECRET:-}" ] || [ -z "${JWT_REFRESH_SECRET:-}" ]; then
  echo "✗ JWT_SECRET and JWT_REFRESH_SECRET must be set in .env.production"
  exit 1
fi
if [ -z "$DB_PASSWORD" ]; then
  echo "✗ DB_PASSWORD must be set in .env.production"
  exit 1
fi

# Ensure FRONTEND_URL matches domain
export FRONTEND_URL="${FRONTEND_URL:-https://$DOMAIN}"
export ADMIN_URL="${ADMIN_URL:-https://$DOMAIN/admin}"
export NODE_ENV=production

echo "✓ Environment loaded (PORT=$PORT DB=$DB_NAME)"

# ── 4. Database setup ─────────────────────────────────────
echo "▶ Setting up MySQL..."
mysql -u root -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null \
  || mysql -u root --skip-password -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null \
  || true
mysql -u root -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';" 2>/dev/null || true
mysql -u root -e "CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD';" 2>/dev/null || true
mysql -u root -e "ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';" 2>/dev/null || true
mysql -u root -e "GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost'; GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1'; FLUSH PRIVILEGES;" 2>/dev/null || true
echo "✓ MySQL ready"

# ── 5. Redis ──────────────────────────────────────────────
echo "▶ Configuring Redis..."
if [ -n "$REDIS_PASSWORD" ] && [ -f /etc/redis/redis.conf ]; then
  if grep -q '^requirepass ' /etc/redis/redis.conf; then
    sed -i "s|^requirepass .*|requirepass $REDIS_PASSWORD|" /etc/redis/redis.conf
  elif grep -q '^# requirepass ' /etc/redis/redis.conf; then
    sed -i "s|^# requirepass .*|requirepass $REDIS_PASSWORD|" /etc/redis/redis.conf
  else
    echo "requirepass $REDIS_PASSWORD" >> /etc/redis/redis.conf
  fi
  systemctl restart redis-server || true
  echo "✓ Redis password set"
else
  echo "  (Redis password empty or conf missing — skipped)"
fi

# ── 6. Backend deps ───────────────────────────────────────
echo "▶ Installing backend dependencies..."
cd "$APP_DIR/backend"
mkdir -p uploads/thumbnails
npm install --omit=dev
echo "✓ Backend dependencies installed"

# ── 7. Database migration ─────────────────────────────────
echo "▶ Running database migrations..."
cd "$APP_DIR/database"
npm install --omit=dev
for f in migrations/00*.js; do
  echo "  → $f"
  node "$f" && echo "    ✓" || echo "    (skipped / already applied)"
done
node seeders/seed.js && echo "✓ seed done" || echo "  (seed skipped)"
node seeders/seed-games.js && echo "✓ seed-games done" || echo "  (seed-games skipped)"

# ── 8. Frontend build ─────────────────────────────────────
echo "▶ Building frontend..."
cd "$APP_DIR/frontend"
npm install
VITE_API_URL="https://$DOMAIN/api" \
VITE_SOCKET_URL="https://$DOMAIN" \
npm run build
if [ ! -d "$APP_DIR/frontend/build" ]; then
  echo "✗ Frontend build failed (no build/ directory)"
  exit 1
fi
echo "✓ Frontend built"

# ── 9. PM2 backend ────────────────────────────────────────
echo "▶ Starting backend with PM2..."
cd "$APP_DIR/backend"
# ecosystem so PM2 always starts from the right cwd
cat > "$APP_DIR/ecosystem.config.cjs" << ECO
module.exports = {
  apps: [{
    name: 'casino-backend',
    cwd: '$APP_DIR/backend',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '512M',
    restart_delay: 3000,
    env: { NODE_ENV: 'production' },
  }],
};
ECO

if pm2 describe casino-backend > /dev/null 2>&1; then
  pm2 delete casino-backend || true
fi
pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -1 | bash || true
echo "✓ Backend running on PM2 (port $PORT)"

# ── 10. Nginx ─────────────────────────────────────────────
echo "▶ Configuring Nginx..."
mkdir -p /var/www/html
SSL_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
SSL_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
HAS_SSL=false
if [ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ]; then
  HAS_SSL=true
fi

# Always write HTTP server (ACME + optional redirect)
cat > /etc/nginx/sites-available/casino << NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

NGINX

if [ "$HAS_SSL" = true ]; then
  cat >> /etc/nginx/sites-available/casino << NGINX
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate     $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    client_max_body_size 10M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    # Backend health (must not fall through to SPA)
    location = /health {
        proxy_pass http://127.0.0.1:$PORT/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    location /webhooks/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    location / {
        root $APP_DIR/frontend/build;
        try_files \$uri \$uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, no-cache";
    }
}
NGINX
else
  # First-time HTTP-only (until certbot runs)
  cat >> /etc/nginx/sites-available/casino << NGINX
    location = /health {
        proxy_pass http://127.0.0.1:$PORT/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    location /webhooks/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    location / {
        root $APP_DIR/frontend/build;
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX
fi

ln -sfn /etc/nginx/sites-available/casino /etc/nginx/sites-enabled/casino
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
echo "✓ Nginx configured (SSL=$HAS_SSL)"

# ── 11. SSL via Let's Encrypt ─────────────────────────────
if [ "$HAS_SSL" = false ]; then
  echo "▶ Obtaining SSL certificate for $DOMAIN ..."
  if certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect 2>/dev/null; then
    echo "✓ SSL certificate installed"
    # Re-run would pick up certs next time; certbot usually edits nginx for us
  else
    echo "⚠ Certbot failed — site is HTTP-only for now"
    echo "  Ensure DNS A record points to this server, then run:"
    echo "    certbot --nginx -d $DOMAIN"
  fi
fi

# ── 12. Health check ──────────────────────────────────────
echo "▶ Health check..."
sleep 4
HEALTHY=false
for i in $(seq 1 15); do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/health" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "✓ Backend healthy (HTTP 200)"
    HEALTHY=true
    break
  fi
  echo "  Waiting for backend... ($i/15) [HTTP $STATUS]"
  sleep 3
done

if [ "$HEALTHY" = false ]; then
  echo "⚠ Backend health check timed out"
  echo "  Run: pm2 logs casino-backend --lines 50"
else
  LOGIN_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
    -X POST "http://127.0.0.1:$PORT/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"smoke@test.com","password":"wrongpassword"}' 2>/dev/null || echo "000")
  if [ "$LOGIN_STATUS" = "401" ] || [ "$LOGIN_STATUS" = "400" ]; then
    echo "✓ Login endpoint OK (HTTP $LOGIN_STATUS)"
  else
    echo "⚠ Login endpoint HTTP $LOGIN_STATUS — check pm2 logs"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deployment complete!"
echo "  🌐 https://$DOMAIN  (or http:// if SSL pending)"
echo "  🔧 https://$DOMAIN/admin"
echo ""
echo "  Demo accounts (if seeded):"
echo "    admin@casino.com / admin123"
echo "    player@casino.com / player123"
echo ""
echo "  Useful commands:"
echo "    pm2 logs casino-backend"
echo "    pm2 restart casino-backend"
echo "    pm2 status"
echo "    curl -s http://127.0.0.1:$PORT/health"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
