#!/bin/bash
set -e

VPS="root@reelx.lazapee.ph"
REMOTE_DIR="/opt/casino-platform"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Building frontend locally ==="
cd "$LOCAL_DIR/frontend"
npm install --legacy-peer-deps --silent
REACT_APP_API_URL=https://reelx.lazapee.ph/api npm run build

echo "=== Uploading build to VPS ==="
scp -r "$LOCAL_DIR/frontend/build/." "$VPS:$REMOTE_DIR/frontend/build/"

echo "=== Reloading nginx ==="
ssh "$VPS" "nginx -t && systemctl reload nginx"

echo "=== DONE — site updated ==="
