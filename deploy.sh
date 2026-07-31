#!/bin/bash
set -e

DOMAIN="reelx.lazapee.ph"
APP_DIR="/opt/casino-platform"
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Casino Platform — Production Deploy"
echo "  Domain: $DOMAIN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Must run on Linux VPS, not Mac
if [[ "$(uname)" == "Darwin" ]]; then
  echo ""
  echo "❌ This script must run ON your VPS, not your Mac."
  echo ""
  echo "   From your Mac, run instead:"
  echo "   ./push-to-vps.sh"
  echo ""
  exit 1
fi

# ── 1. System packages ────────────────────────────────────
echo "▶ Installing system packages..."
# Remove ALL stale nodesource repo entries
rm -f /etc/apt/sources.list.d/nodesource*.list
rm -f /etc/apt/sources.list.d/node*.list
rm -f /etc/apt/keyrings/nodesource*.gpg
sed -i '/nodesource/d' /etc/apt/sources.list 2>/dev/null || true
apt-get update -qq || true
apt-get install -y -qq curl git ufw nginx certbot python3-certbot-nginx || true

# Node.js — already installed (v22), skip if any version present
if ! command -v node &>/dev/null; then
  echo "▶ Installing Node.js 18..."
  apt-get install -y ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y nodejs
fi

# PM2
if ! command -v pm2 &>/dev/null; then
  echo "▶ Installing PM2..."
  npm install -g pm2
fi

# PostgreSQL
if ! command -v mysql &>/dev/null; then
  echo "▶ Installing MySQL..."
  apt-get install -y mysql-server
  systemctl enable mysql
  systemctl start mysql
fi

# Redis
if ! command -v redis-cli &>/dev/null; then
  echo "▶ Installing Redis..."
  apt-get install -y redis-server
  systemctl enable redis-server
  systemctl start redis-server
fi

echo "✓ System packages ready"

# ── 2. Firewall ───────────────────────────────────────────
echo "▶ Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "✓ Firewall configured"

# ── 3. Load env ───────────────────────────────────────────
if [ ! -f "$APP_DIR/.env.production" ]; then
  echo "✗ ERROR: $APP_DIR/.env.production not found"
  exit 1
fi
export $(grep -v '^#' "$APP_DIR/.env.production" | xargs)
echo "✓ Environment loaded"

# ── 4. Database setup ─────────────────────────────────────
echo "▶ Setting up MySQL..."
mysql -u root -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;" 2>/dev/null || \
  mysql -u root --skip-password -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`;" 2>/dev/null || true
mysql -u root -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';" 2>/dev/null || true
mysql -u root -e "GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost'; FLUSH PRIVILEGES;" 2>/dev/null || true
echo "✓ MySQL ready"

# ── 5. Redis password ─────────────────────────────────────
echo "▶ Configuring Redis..."
sed -i "s/^# requirepass.*/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
sed -i "s/^requirepass.*/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf
systemctl restart redis-server
echo "✓ Redis configured"

# ── 6. Backend ────────────────────────────────────────────
echo "▶ Installing backend dependencies..."
cd "$APP_DIR/backend"
mkdir -p uploads/thumbnails
npm install --production
echo "✓ Backend dependencies installed"

# ── 7. Database migration ─────────────────────────────────
echo "▶ Running database migrations..."
cd "$APP_DIR/database"
npm install
node migrations/001_initial.js && echo "✓ 001_initial done" || echo "  (already migrated)"
node migrations/002_game_controls.js && echo "✓ 002_game_controls done" || echo "  (already migrated)"
node migrations/003_affiliation.js && echo "✓ 003_affiliation done" || echo "  (already migrated)"
node migrations/004_kyc_bonus.js && echo "✓ 004_kyc_bonus done" || echo "  (already migrated)"
node migrations/005_fix_game_controls.js && echo "✓ 005_fix_game_controls done" || echo "  (already migrated)"
node migrations/006_backfill_referral_codes.js && echo "✓ 006_backfill_referral_codes done" || echo "  (already migrated)"
node migrations/007_sessions_updated_at.js && echo "✓ 007_sessions_updated_at done" || echo "  (already migrated)"
node seeders/seed.js && echo "✓ seed done" || echo "  (already seeded)"
node seeders/seed-games.js && echo "✓ seed-games done" || echo "  (already seeded)"

# ── 8. Frontend build ─────────────────────────────────────
echo "▶ Building frontend..."
cd "$APP_DIR/frontend"
npm install
VITE_API_URL="https://$DOMAIN/api" VITE_SOCKET_URL="https://$DOMAIN" npm run build
# Vite outputs to 'build' (configured in vite.config.js outDir: 'build')
echo "✓ Frontend built"

# ── 9. PM2 backend process ────────────────────────────────
echo "▶ Starting backend with PM2..."
cd "$APP_DIR/backend"
# Use reload for zero-downtime restarts on updates; start fresh only on first deploy
if pm2 describe casino-backend > /dev/null 2>&1; then
  pm2 reload casino-backend --update-env
else
  pm2 start server.js --name casino-backend --env production \
    --max-memory-restart 512M \
    --restart-delay 3000
fi
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true
echo "✓ Backend running on PM2"

# ── 10. Nginx config ──────────────────────────────────────
echo "▶ Configuring Nginx..."
cat > /etc/nginx/sites-available/casino << EOF
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_session_cache   shared:SSL:10m;

    client_max_body_size 10M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # API
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
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # Webhook
    location /webhooks/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    # Frontend static files
    location / {
        root $APP_DIR/frontend/build;
        try_files \$uri \$uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, no-cache";
    }
}
EOF

ln -sf /etc/nginx/sites-available/casino /etc/nginx/sites-enabled/casino
rm -f /etc/nginx/sites-enabled/default

# ── 11. SSL certificate ───────────────────────────────────
echo "▶ Obtaining SSL certificate..."
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  # Temp HTTP-only config for certbot
  cat > /etc/nginx/sites-available/casino << TMPEOF
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 200 'ok'; add_header Content-Type text/plain; }
}
TMPEOF
  nginx -t && systemctl reload nginx
  certbot certonly --webroot -w /var/www/html \
    --email admin@lazapee.ph --agree-tos --no-eff-email \
    -d "$DOMAIN" --non-interactive
  echo "✓ SSL certificate obtained"
else
  echo "✓ SSL certificate already exists"
fi

# Restore full nginx config
cat > /etc/nginx/sites-available/casino << EOF
server {
    listen 80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_session_cache   shared:SSL:10m;

    client_max_body_size 10M;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

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
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
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
    }

    location / {
        root $APP_DIR/frontend/build;
        try_files \$uri \$uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, no-cache";
    }
}
EOF

nginx -t && systemctl reload nginx
echo "✓ Nginx configured"

# ── 12. Health check + smoke test ────────────────────────
echo "▶ Health check..."
sleep 5
HEALTHY=false
for i in {1..15}; do
  STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/health" 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "✓ Backend is healthy (HTTP 200)"
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
  # Smoke test: verify login endpoint responds (401 = working, wrong creds expected)
  LOGIN_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
    -X POST "http://127.0.0.1:$PORT/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"smoke@test.com","password":"wrongpassword"}' 2>/dev/null || echo "000")
  if [ "$LOGIN_STATUS" = "401" ] || [ "$LOGIN_STATUS" = "400" ]; then
    echo "✓ Login endpoint OK (HTTP $LOGIN_STATUS)"
  else
    echo "⚠ Login endpoint returned HTTP $LOGIN_STATUS — check: pm2 logs casino-backend"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Deployment complete!"
echo "  🌐 https://$DOMAIN"
echo "  🔧 https://$DOMAIN/admin"
echo ""
echo "  Useful commands:"
echo "  Logs:    pm2 logs casino-backend"
echo "  Restart: pm2 restart casino-backend"
echo "  Status:  pm2 status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
