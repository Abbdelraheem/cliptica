#!/bin/bash
set -e
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/opt/nology-backups/automated"
mkdir -p "$BACKUP_DIR"
DUMP_FILE="$BACKUP_DIR/cliptica_$TIMESTAMP.sql"

# Dump database
sudo -u postgres pg_dump cliptica > "$DUMP_FILE"
gzip -f "$DUMP_FILE"

# Keep latest uncompressed copy for emergency instant restore
sudo -u postgres pg_dump cliptica > /opt/nology-backups/cliptica_production_backup.sql

# Retain backups for 30 days
find "$BACKUP_DIR" -type f -name "cliptica_*.sql.gz" -mtime +30 -delete

echo "[$(date)] Automated backup completed: ${DUMP_FILE}.gz" >> /opt/nology-backups/backup.log
