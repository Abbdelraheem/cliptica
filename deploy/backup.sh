#!/usr/bin/env bash
# ============================================================
# NOLOGY Backup Script
# ============================================================
# Creates comprehensive backups of database and application state
# 
# Usage:
#   ./backup.sh                    # Full backup
#   ./backup.sh --database-only    # Database only
#   ./backup.sh --files-only       # Application files only
#   ./backup.sh --list             # List available backups
#   ./backup.sh --restore <name>   # Restore from backup
# ============================================================
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Configuration
APP_DIR="/opt/nology"
BACKUP_DIR="/opt/nology-backups"
MAX_BACKUPS=10
S3_BUCKET="${BACKUP_S3_BUCKET:-}"

# Parse arguments
MODE="full"
RESTORE_NAME=""
LIST_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --database-only) MODE="database" ;;
        --files-only) MODE="files" ;;
        --list) LIST_ONLY=true ;;
        --restore) RESTORE_NAME="$2"; shift ;;
        *) log_error "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

# Load environment
if [[ -f /opt/nology/.env.production ]]; then
    set +u
    set -a
    source /opt/nology/.env.production
    set +a
    set -u
fi

# Create backup directory
mkdir -p /opt/nology-backups

# List backups
if [[ "$LIST_ONLY" == "true" ]]; then
    echo "Available backups:"
    ls -dt /opt/nology-backups/nology-backup-* 2>/dev/null | while read -r backup; do
        SIZE=$(du -sh "$backup" 2>/dev/null | cut -f1)
        DATE=$(stat -c %y "$backup" | cut -d' ' -f1)
        echo "  $(basename "$backup") - $DATE - $SIZE"
    done
    exit 0
fi

# Restore
if [[ -n "$RESTORE_NAME" ]]; then
    BACKUP_PATH="/opt/nology-backups/$RESTORE_NAME"
    if [[ ! -d "$BACKUP_PATH" ]]; then
        log_error "Backup not found: $RESTORE_NAME"
        exit 1
    fi
    
    echo "Restoring from $RESTORE_NAME..."
    read -p "This will overwrite current data. Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    
    # Stop services
    pm2 stop all 2>/dev/null || true
    
    # Restore database
    if [[ -f "$BACKUP_PATH/database.sql" ]]; then
        log_info "Restoring database..."
        psql "$DATABASE_URL" < "$BACKUP_PATH/database.sql" 2>/dev/null || log_warn "Database restore had warnings"
    fi
    
    # Restore files
    if [[ -d "$BACKUP_PATH/app" ]]; then
        log_info "Restoring application files..."
        rsync -a --delete "$BACKUP_PATH/app/" /opt/nology/ 2>/dev/null || true
    fi
    
    # Restart services
    cd /opt/nology
    npm ci --silent
    npx prisma generate
    npm run build
    pm2 start deploy/pm2.ecosystem.config.cjs
    pm2 save
    
    log_success "Restore completed from $RESTORE_NAME"
    exit 0
fi

# Create backup
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="nology-backup-$TS"
BACKUP_PATH="/opt/nology-backups/$BACKUP_NAME"

echo "Creating backup: $BACKUP_NAME"
mkdir -p "$BACKUP_PATH"

# Backup database
if [[ "$MODE" != "files" ]]; then
    log_info "Backing up database..."
    if command -v pg_dump &>/dev/null && [[ -n "${DATABASE_URL:-}" ]]; then
        DB_ERR=$(pg_dump "$DATABASE_URL" --schema=public --no-owner --no-privileges -f "$BACKUP_PATH/database.sql" 2>&1 || true)
        if [[ -s "$BACKUP_PATH/database.sql" ]]; then
            log_success "Database backup completed ($(du -sh "$BACKUP_PATH/database.sql" | cut -f1))"
        else
            log_warn "Database backup failed: $DB_ERR"
        fi
    else
        log_warn "Database backup skipped (pg_dump not available or DATABASE_URL not set)"
    fi
fi

# Backup application files
if [[ "$MODE" != "database" ]]; then
    log_info "Backing up application files..."
    mkdir -p "$BACKUP_PATH/app"
    
    rsync -a --exclude='node_modules' --exclude='.next' --exclude='.git' \
        --exclude='logs' --exclude='*.log' --exclude='*.pid' \
        --exclude='.vercel' --exclude='.turbo' \
        /opt/nology/ "$BACKUP_PATH/app/" 2>/dev/null || true
    
    log_success "Application files backed up"
fi

# Create manifest
cat > "$BACKUP_PATH/manifest.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "git_commit": "$(cd /opt/nology && git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(cd /opt/nology && git branch --show-current 2>/dev/null || echo 'unknown')",
  "mode": "$MODE",
  "version": "$(cat /opt/nology/package.json 2>/dev/null | grep '"version"' | head -n1 | cut -d'"' -f4 || echo '0.1.0')"
}
EOF

# Upload to S3 if configured
if [[ -n "$S3_BUCKET" ]]; then
    log_info "Uploading backup to S3..."
    if command -v aws &>/dev/null; then
        aws s3 cp "$BACKUP_PATH" "s3://$S3_BUCKET/nology-backups/$BACKUP_NAME/" --recursive --storage-class STANDARD_IA
        log_success "Backup uploaded to S3"
    else
        log_warn "AWS CLI not installed, skipping S3 upload"
    fi
fi

# Cleanup old backups
log_info "Cleaning up old backups (keeping last 10)..."
ls -dt /opt/nology-backups/nology-backup-* 2>/dev/null | tail -n +11 | xargs rm -rf 2>/dev/null || true

# Show backup size
BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
log_success "Backup completed: $BACKUP_NAME ($BACKUP_SIZE)"

# List backups
echo ""
echo "Available backups:"
ls -dt /opt/nology-backups/nology-backup-* 2>/dev/null | while read -r backup; do
    SIZE=$(du -sh "$backup" 2>/dev/null | cut -f1)
    DATE=$(stat -c %y "$backup" | cut -d' ' -f1)
    echo "  $(basename "$backup") - $DATE - $SIZE"
done