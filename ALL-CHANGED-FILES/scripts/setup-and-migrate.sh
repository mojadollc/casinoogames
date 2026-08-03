#!/usr/bin/env bash
# Local setup helper for casinoogames (MySQL + migrations + seed)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Installing backend deps"
cd backend && npm install
cd "$ROOT/database" && npm install

echo "==> Ensure MySQL database exists (edit credentials as needed)"
echo "    mysql -u root -p -e \"CREATE DATABASE IF NOT EXISTS casino_platform; CREATE USER IF NOT EXISTS 'casino'@'%' IDENTIFIED BY 'your_password_here'; GRANT ALL ON casino_platform.* TO 'casino'@'%'; FLUSH PRIVILEGES;\""

echo "==> Copy env if missing"
if [ ! -f "$ROOT/backend/.env" ]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "    Created backend/.env — edit DB_* and JWT_* before starting"
fi

# Prefer .env.production for migrations (as existing migration files do)
if [ ! -f "$ROOT/.env.production" ]; then
  cat > "$ROOT/.env.production" <<ENV
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=casino_platform
DB_USER=casino
DB_PASSWORD=your_password_here
ENV
  echo "    Created .env.production for migrations"
fi

echo "==> Running migrations"
cd "$ROOT/database"
for f in migrations/00*.js; do
  echo "    $f"
  node "$f" || true
done

echo "==> Seeding"
node seeders/seed.js || true
node seeders/seed-games.js || true

echo "==> Done. Start backend: cd backend && npm run dev"
echo "    Start frontend: cd frontend && npm install && npm start"
echo "    Smoke test: API_URL=http://localhost:3020/api node scripts/smoke-test.js"
