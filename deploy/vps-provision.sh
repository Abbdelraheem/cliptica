#!/usr/bin/env bash
# ============================================================
# NOLOGY — Production VPS Provisioning Script (phase 1)
# ============================================================
# Target: Ubuntu 22.04 / 24.04 (x86_64 or aarch64)
# Run as root:  sudo bash deploy/vps-provision.sh
# Time: ~15–20 min | Downloads ~2.5 GB total
# Disk: requires >= 8 GB free (recommend 20 GB+ volume)
#
# Installs:
#   - Node.js 20 LTS + PM2 (+ pm2-logrotate)
#   - FFmpeg + ffprobe + yt-dlp
#   - Python 3.11 venv: faster-whisper + InsightFace + OpenCV + torch (CPU)
#   - AWS CLI v2 (used by worker for R2 S3 ops)
#   - Clones app -> builds -> runs Prisma migrations -> starts PM2
#
# Phase 1 = app live on HTTP :3000. Nginx + SSL + domain come in phase 2.
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REPO_URL="${REPO_URL:-https://github.com/Abbdelraheem/cliptica.git}"
APP_DIR="/opt/nology"
BRANCH="${BRANCH:-main}"
LOG_FILE="/var/log/nology-provision.log"

log_info() { echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; }

if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root"
    exit 1
fi

mkdir -p /var/log/nology
echo "=== NOLOGY Provisioning started at $(date) ===" > "$LOG_FILE"

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
    aarch64|arm64) ARCH_SUFFIX="aarch64" ;;
    x86_64) ARCH_SUFFIX="x86_64" ;;
    *) log_error "Unsupported architecture: $ARCH"; exit 1 ;;
esac
log_info "Detected architecture: $ARCH_SUFFIX"

# Disk preflight
DISK_FREE_KB=$(df -k /opt | awk 'NR==2 {print $4}')
DISK_FREE_GB=$(( DISK_FREE_KB / 1024 / 1024 ))
log_info "Free disk on /opt: ${DISK_FREE_GB} GB"
if [[ $DISK_FREE_GB -lt 8 ]]; then
    log_error "Insufficient disk space (${DISK_FREE_GB} GB free, need >= 8 GB)."
    log_error "Grow the volume first (AWS: stop instance -> modify volume -> start), then re-run."
    exit 1
fi

# ============================================================
# [1/10] System packages
# ============================================================
log_info "[1/10] Installing system packages (~350 MB, 3-5 min)"
{
    apt-get update -qq
    apt-get install -y -qq \
        curl git ca-certificates gnupg lsb-release software-properties-common \
        build-essential pkg-config cmake \
        python3 python3-pip python3-venv python3-dev python3.11-venv python3.11-dev \
        ffmpeg ffprobe jq wget unzip \
        logrotate cron rsync sqlite3 postgresql-client \
        >/dev/null
} 2>&1 | tee -a "$LOG_FILE"
log_success "System packages installed"

# ============================================================
# [2/10] Node.js 20 LTS
# ============================================================
log_info "[2/10] Installing Node.js 20 LTS + PM2 (~50 MB, 1 min)"
{
    curl -fsSL "https://deb.nodesource.com/setup_20.x" | bash - >/dev/null
    apt-get install -y -qq nodejs >/dev/null
    npm i -g pm2@latest pm2-logrotate@latest --silent
} 2>&1 | tee -a "$LOG_FILE"
log_success "Node.js $(node --version) + PM2 $(pm2 --version) installed"

# ============================================================
# [3/10] yt-dlp
# ============================================================
log_info "[3/10] Installing yt-dlp (~35 MB, 30 s)"
{
    YTDLP_URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_${ARCH_SUFFIX}"
    curl -L "$YTDLP_URL" -o /usr/local/bin/yt-dlp
    chmod +x /usr/local/bin/yt-dlp
    yt-dlp --version
} 2>&1 | tee -a "$LOG_FILE"
log_success "yt-dlp installed"

# ============================================================
# [4/10] FFmpeg verification
# ============================================================
log_info "[4/10] Verifying FFmpeg + ffprobe"
{
    ffmpeg -version | head -1
    ffprobe -version | head -1
} 2>&1 | tee -a "$LOG_FILE"
log_success "FFmpeg + ffprobe verified"

# ============================================================
# [5/10] Python 3.11 venv + AI dependencies
# ============================================================
log_info "[5/10] Python AI venv (~2.2 GB, 8-12 min)"
{
    apt-get install -y -qq python3.11-venv python3.11-dev >/dev/null
    python3.11 -m venv /opt/nology-venv
    /opt/nology-venv/bin/pip install -q --upgrade pip setuptools wheel
    /opt/nology-venv/bin/pip install -q --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    /opt/nology-venv/bin/pip install -q --no-cache-dir \
        faster-whisper insightface opencv-python-headless \
        onnxruntime onnx \
        boto3 botocore
    /opt/nology-venv/bin/python -c "
import torch, cv2, numpy as np, insightface, onnxruntime
from faster_whisper import WhisperModel
print('torch', torch.__version__, '| opencv', cv2.__version__, '| onnx', onnxruntime.__version__)
print('All AI dependencies imported successfully')
"
} 2>&1 | tee -a "$LOG_FILE"
log_success "Python AI dependencies installed"

# ============================================================
# [6/10] AWS CLI v2 (worker uses it for R2)
# ============================================================
log_info "[6/10] Installing AWS CLI v2 (~100 MB, 1 min)"
{
    curl -s "https://awscli.amazonaws.com/awscli-exe-linux-${ARCH_SUFFIX}.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install --update
    rm -rf /tmp/awscliv2.zip /tmp/aws
    aws --version
} 2>&1 | tee -a "$LOG_FILE"
log_success "AWS CLI v2 installed"

# ============================================================
# [7/10] PM2 logrotate + startup
# ============================================================
log_info "[7/10] Configuring PM2 logrotate + startup"
{
    pm2 install pm2-logrotate -s
    pm2 set pm2-logrotate:max_size 100M
    pm2 set pm2-logrotate:retain 30
    pm2 set pm2-logrotate:compress true
    pm2 set pm2-logrotate:workerInterval 3600
    pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
} 2>&1 | tee -a "$LOG_FILE"
log_success "PM2 logrotate + startup configured"

# ============================================================
# [8/10] Clone repository + environment file
# ============================================================
log_info "[8/10] Cloning repository (~1 min)"
{
    if [ -d "$APP_DIR" ]; then
        cd "$APP_DIR"
        git fetch origin
        git reset --hard "origin/$BRANCH"
        git clean -fd
    else
        git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$APP_DIR"
        cd "$APP_DIR"
    fi
    if [ -f "/opt/nology.env" ]; then
        cp /opt/nology.env "$APP_DIR/.env.production"
        chmod 600 "$APP_DIR/.env.production"
        log_success ".env.production seeded from /opt/nology.env"
    elif [ ! -f "$APP_DIR/.env.production" ]; then
        cp deploy/.env.production.example "$APP_DIR/.env.production"
        log_warn "CREATED placeholder .env.production — EDIT before build: nano /opt/nology/.env.production"
    fi
} 2>&1 | tee -a "$LOG_FILE"
log_success "Repository cloned"

# ============================================================
# [9/10] Install deps + Prisma generate + build
# ============================================================
log_info "[9/10] npm ci + prisma generate + build (~5-7 min)"
{
    cd "$APP_DIR"
    npm ci --silent
    npx prisma generate
    npm run build
} 2>&1 | tee -a "$LOG_FILE"
log_success "Application built"

# ============================================================
# [10/10] Database migrations + PM2 start
# ============================================================
log_info "[10/10] Running Prisma migrations + starting PM2"
{
    cd "$APP_DIR"
    set -a; source "$APP_DIR/.env.production" 2>/dev/null || true; set +a
    if [[ -n "${DATABASE_URL:-}" ]]; then
        npx prisma migrate deploy
    else
        log_warn "DATABASE_URL missing in .env.production — skipping migrations"
    fi
    npx prisma generate
    pm2 start deploy/pm2.ecosystem.config.cjs
    pm2 save
} 2>&1 | tee -a "$LOG_FILE"
log_success "PM2 processes started"

# ============================================================
# Verification
# ============================================================
log_info "Running verification checks..."
{
    cd "$APP_DIR"
    pm2 status
    sleep 6
    curl -sf --max-time 15 http://localhost:3000/api/health >/dev/null \
        && log_success "Health check passed on :3000" \
        || log_warn "Health check failed (app may still be starting — check pm2 logs)"
    if command -v prisma >/dev/null || true; then :; fi
    set -a; source "$APP_DIR/.env.production" 2>/dev/null || true; set +a
    if [[ -n "${DATABASE_URL:-}" ]]; then
        npx prisma db execute --stdin <<< "SELECT 1" >/dev/null 2>&1 \
            && log_success "Database connection OK" || log_warn "Database check failed"
    fi
} 2>&1 | tee -a "$LOG_FILE"

log_success "=== PROVISIONING COMPLETE ==="
echo ""
echo "=============================================="
echo " NEXT STEPS:"
echo " 1) .env.production: fill R2 / Groq / Stripe / OAuth keys (later phase)"
echo " 2) Domain + DNS A record -> $(curl -s ifconfig.me || echo 'SERVER_IP')"
echo " 3) Phase 2: nginx + certbot for HTTPS"
echo " 4) Monitor: pm2 logs nology-web --lines 50"
echo "=============================================="
echo "Provision log: $LOG_FILE"