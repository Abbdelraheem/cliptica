#!/usr/bin/env bash
# ============================================================
# NOLOGY — Oracle Cloud Always Free VPS one-shot installer
# Target: Ubuntu 22.04 / 24.04 (aarch64 ARM, Ampere A1)
# Run as root:  bash vps-install.sh
# Time: ~8–12 min | Downloads ~700 MB total
# ============================================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Abbdelraheem/cliptica.git}"
APP_DIR="/opt/nology"
BRANCH="${BRANCH:-main}"

echo "==> [1/8] System packages (~90 MB, 2-3 min)"
apt-get update -qq
apt-get install -y -qq curl git ca-certificates ffmpeg python3-pip python3-venv awscli jq >/dev/null

echo "==> [2/8] Node.js 20 (~30 MB, 1 min)"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
apt-get install -y -qq nodejs >/dev/null

echo "==> [3/8] yt-dlp (~35 MB, 30 s)"
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64 -o /usr/local/bin/yt-dlp
chmod +x /usr/local/bin/yt-dlp

echo "==> [4/8] PM2"
npm i -g pm2 --silent

echo "==> [5/8] Python env for faster-whisper (~450 MB with model cache, 3-5 min)"
python3 -m venv /opt/nology-venv
/opt/nology-venv/bin/pip install -q --upgrade pip
/opt/nology-venv/bin/pip install -q faster-whisper

echo "==> [6/8] Clone + build app (~2.5 MB clone, build 3-4 min)"
if [ -d "$APP_DIR" ]; then cd "$APP_DIR" && git fetch && git reset --hard "origin/$BRANCH"; else git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$APP_DIR" && cd "$APP_DIR"; fi
npm ci --silent
npx prisma generate
npm run build

echo "==> [7/8] Environment file"
if [ ! -f "$APP_DIR/.env.production" ]; then
  cp deploy/.env.production.example "$APP_DIR/.env.production"
  echo ">> EDIT NOW: nano $APP_DIR/.env.production  (DATABASE_URL / R2 keys / secrets)"
fi

echo "==> [8/8] Caddy web server (auto-HTTPS, ~40 MB)"
curl -o /usr/local/bin/caddy "https://caddyserver.com/api/download?os=linux&arch=arm64&p=github.com%2Fcaddyserver%2Fcaddy%2Fmodules%2Fstandard"
chmod +x /usr/local/bin/caddy
cat > /etc/caddy/Caddyfile <<EOF
{\$NOLOGY_DOMAIN} {
    reverse_proxy 127.0.0.1:3000
}
EOF

cp deploy/nology-caddy.service /etc/systemd/system/caddy-nology.service
systemctl daemon-reload

echo ""
echo "=============================================="
echo " DONE. Next steps:"
echo " 1) nano $APP_DIR/.env.production   # fill real values"
echo " 2) cd $APP_DIR && pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup"
echo " 3) NOLOGY_DOMAIN=app.yourdomain.com systemctl enable --now caddy-nology"
echo "=============================================="
