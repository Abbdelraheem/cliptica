#!/usr/bin/env bash
# ============================================================
# NOLOGY Deployment Script
# ============================================================
# Usage:
#   ./deploy.sh [branch]        # Deploy to production
#   ./deploy.sh --rollback      # Rollback to previous version
#   ./deploy.sh --status        # Show deployment status
#
# Features:
# - Zero-downtime deployment for web app
# - Graceful worker restart
# - Pre-deployment validation
# - Automatic rollback on failure
# - Health checks before/after deployment
# - Slack/Discord notification support (optional)
# ============================================================
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
APP_DIR="/opt/nology"
REPO_URL="${REPO_URL:-https://github.com/Abbdelraheem/cliptica.git}"
BRANCH="${1:-main}"
DEPLOY_LOG="/var/log/nology-deploy-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="/opt/nology-backups"
MAX_BACKUPS=5

# Ensure running as root
if [[ $EUID -ne 0 ]]; then
    log_error "Run as root: sudo bash $0"
    exit 1
fi

# Parse arguments
ROLLBACK=false
STATUS_ONLY=false
case "${1:-}" in
    --rollback) ROLLBACK=true ;;
    --status) STATUS_ONLY=true ;;
    *) BRANCH="${1:-main}" ;;
esac

log_info() { echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$DEPLOY_LOG"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOY_LOG"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$DEPLOY_LOG"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOY_LOG"; }

# Start logging
mkdir -p /var/log/nology
echo "=== Deployment started at $(date) ===" > "$DEPLOY_LOG"
echo "Branch: $BRANCH" | tee -a "$DEPLOY_LOG"

# Helper: Health check
health_check() {
    local url="${1:-http://localhost:3000/api/health}"
    local timeout="${2:-10}"
    local retries="${3:-3}"
    
    for i in $(seq 1 $retries); do
        if curl -sf --max-time "$timeout" "$url" >/dev/null; then
            return 0
        fi
        sleep 2
    done
    return 1
}

# Helper: Check PM2 status
check_pm2_status() {
    pm2 jlist | jq -r '.[] | select(.name=="nology-web" or .name=="nology-worker") | "\(.name): \(.pm2_env.status) (\(.pm2_env.pm_uptime // 0)ms uptime)"' 2>/dev/null || true
}

# Helper: Create backup
create_backup() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_path="$BACKUP_DIR/nology-backup-$timestamp"
    
    log_info "Creating backup at $backup_path"
    mkdir -p "$BACKUP_DIR"
    
    # Backup database (if local PostgreSQL)
    if command -v pg_dump &>/dev/null && [[ -n "${DATABASE_URL:-}" ]]; then
        pg_dump "$DATABASE_URL" > "$backup_path/database.sql" 2>/dev/null || true
    fi
    
    # Backup application files (excluding node_modules, .next, logs)
    rsync -a --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='logs' \
        --exclude='*.log' --exclude='*.pid' \
        "$APP_DIR/" "$backup_path/app/" 2>/dev/null || true
    
    # Keep only last N backups
    ls -dt "$BACKUP_DIR"/nology-backup-* 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -rf 2>/dev/null || true
    
    echo "$backup_path"
}

# Helper: Restore from backup
restore_backup() {
    local backup_path="$1"
    
    if [[ ! -d "$backup_path" ]]; then
        log_error "Backup not found: $backup_path"
        return 1
    fi
    
    log_warn "Restoring from backup: $backup_path"
    
    # Stop services
    pm2 stop all
    
    # Restore database
    if [[ -f "$backup_path/database.sql" ]]; then
        log_info "Restoring database..."
        psql "$DATABASE_URL" < "$backup_path/database.sql" 2>/dev/null || log_warn "Database restore failed"
    fi
    
    # Restore application files
    log_info "Restoring application files..."
    rsync -a --delete "$backup_path/app/" "$APP_DIR/" 2>/dev/null || true
    
    # Reinstall dependencies and rebuild
    cd "$APP_DIR"
    npm ci --silent
    npx prisma generate
    npm run build
    
    # Restart services
    pm2 start deploy/pm2.ecosystem.config.cjs
    pm2 save
    
    log_success "Restored from backup: $backup_path"
}

# Helper: Send notification (placeholder for Slack/Discord)
notify() {
    local status="$1"
    local message="$2"
    # Add Slack/Discord webhook here if needed
    log_info "Notification: $status - $message"
}

# Pre-deployment checks
pre_deploy_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check disk space
    local disk_free=$(df -h /opt | awk 'NR==2 {print $4}')
    log_info "Disk free: $disk_free"
    
    # Check memory
    local mem_free=$(free -h | awk '/^Mem:/ {print $7}')
    log_info "Memory free: $mem_free"
    
    # Check PM2 processes
    log_info "Current PM2 status:"
    check_pm2_status
    
    # Health check before deployment
    if health_check; then
        log_success "Pre-deployment health check passed"
    else
        log_warn "Pre-deployment health check failed - continuing anyway"
    fi
    
    # Check environment file
    if [[ ! -f "/opt/nology/.env.production" ]]; then
        log_error "Environment file not found: /opt/nology/.env.production"
        exit 1
    fi
    
    # Validate required env vars
    source /opt/nology/.env.production
    local required_vars=("DATABASE_URL" "NEXTAUTH_SECRET" "NEXTAUTH_URL" "R2_ENDPOINT" "R2_BUCKET" "R2_ACCESS_KEY_ID" "R2_SECRET_ACCESS_KEY" "GROQ_API_KEY" "STRIPE_SECRET_KEY" "STRIPE_WEBHOOK_SECRET")
    local missing=0
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]] || [[ "${!var}" == *"placeholder"* ]] || [[ "${!var}" == *"CHANGE"* ]]; then
            log_warn "Missing or placeholder: $var"
        fi
    done
}

# Main deployment function
deploy() {
    log_info "Starting deployment of branch: $BRANCH"
    
    # Pre-deployment checks
    pre_deploy_checks
    
    # Create backup
    local backup_path=$(create_backup)
    log_success "Backup created: $backup_path"
    
    cd "$APP_DIR"
    
    # Fetch latest changes
    log_info "Fetching latest changes from $BRANCH..."
    git fetch origin
    git reset --hard "origin/$BRANCH"
    git clean -fd
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm ci --silent
    
    # Generate Prisma client
    log_info "Generating Prisma client..."
    npx prisma generate
    
    # Run database migrations
    log_info "Running database migrations..."
    npx prisma migrate deploy
    
    # Build Next.js application
    log_info "Building Next.js application..."
    npm run build
    
    # Reload web app (zero-downtime)
    log_info "Reloading web application (zero-downtime)..."
    pm2 reload nology-web --update-env
    
    # Restart worker (graceful)
    log_info "Restarting worker (graceful)..."
    pm2 restart nology-worker --update-env
    
    # Save PM2 configuration
    pm2 save
    
    # Wait for services to stabilize
    sleep 5
    
    # Post-deployment health checks
    log_info "Running post-deployment health checks..."
    local health_ok=true
    
    if health_check; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        health_ok=false
    fi
    
    # Check PM2 processes
    local pm2_status=$(check_pm2_status)
    if echo "$pm2_status" | grep -q "online"; then
        log_success "PM2 processes are online"
    else
        log_error "Some PM2 processes are not online"
        health_ok=false
    fi
    
    if [[ "$health_ok" == "true" ]]; then
        log_success "=== DEPLOYMENT SUCCESSFUL ==="
        notify "success" "Deployment of $BRANCH completed successfully"
        return 0
    else
        log_error "=== DEPLOYMENT FAILED - INITIATING ROLLBACK ==="
        notify "failure" "Deployment of $BRANCH failed, rolling back"
        rollback
        return 1
    fi
}

# Rollback function
rollback() {
    log_warn "Initiating rollback..."
    
    # Find latest backup
    local latest_backup=$(ls -dt "$BACKUP_DIR"/nology-backup-* 2>/dev/null | head -1)
    
    if [[ -z "$latest_backup" ]]; then
        log_error "No backup found for rollback"
        return 1
    fi
    
    log_warn "Rolling back to: $latest_backup"
    restore_backup "$latest_backup"
    
    # Verify rollback
    sleep 5
    if health_check; then
        log_success "Rollback successful"
        notify "warning" "Rollback completed successfully"
        return 0
    else
        log_error "Rollback failed - manual intervention required"
        notify "critical" "Rollback failed - manual intervention required"
        return 1
    fi
}

# Status function
status() {
    log_info "=== NOLOGY Deployment Status ==="
    echo ""
    echo "=== PM2 Status ==="
    check_pm2_status
    echo ""
    echo "=== Disk Usage ==="
    df -h /opt
    echo ""
    echo "=== Memory ==="
    free -h
    echo ""
    echo "=== Recent Deployments ==="
    ls -dt /opt/nology-backups/nology-backup-* 2>/dev/null | head -5 | while read backup; do
        echo "  $(basename "$backup") - $(stat -c %y "$backup" | cut -d' ' -f1)"
    done
    echo ""
    echo "=== Health Check ==="
    if health_check; then
        log_success "Health check: PASS"
    else
        log_error "Health check: FAIL"
    fi
}

# Main execution
case "${1:-}" in
    --rollback)
        rollback
        ;;
    --status)
        status
        ;;
    *)
        deploy
        ;;
esac

log_info "Deployment script completed"
echo "Deployment log: $DEPLOY_LOG"