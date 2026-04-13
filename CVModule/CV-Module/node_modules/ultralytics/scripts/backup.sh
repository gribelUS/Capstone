#!/bin/bash

# Ultralytics Database Backup Script
# Usage: ./scripts/backup.sh [output_dir]
#
# Environment variables:
#   DATABASE_URL - PostgreSQL connection string (required)
#   BACKUP_RETENTION_DAYS - Number of days to keep backups (default: 7)

set -e

# Configuration
OUTPUT_DIR="${1:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="ultralytics_backup_${TIMESTAMP}.sql.gz"

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is required"
    exit 1
fi

# Parse DATABASE_URL
# Format: postgres://user:password@host:port/database
PROTO="$(echo $DATABASE_URL | grep :// | sed -e's,^\(.*://\).*,\1,g')"
URL="$(echo ${DATABASE_URL/$PROTO/})"
USERPASS="$(echo $URL | grep @ | cut -d@ -f1)"
HOSTPORT="$(echo ${URL/$USERPASS@/} | cut -d/ -f1)"
DB_HOST="$(echo $HOSTPORT | cut -d: -f1)"
DB_PORT="$(echo $HOSTPORT | cut -d: -f2)"
DB_NAME="$(echo $URL | grep / | cut -d/ -f2-)"
DB_USER="$(echo $USERPASS | cut -d: -f1)"
DB_PASS="$(echo $USERPASS | cut -d: -f2)"

# Set default port if not specified
if [ "$DB_PORT" = "$DB_HOST" ]; then
    DB_PORT="5432"
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "Starting backup of database: $DB_NAME"
echo "Output: $OUTPUT_DIR/$BACKUP_FILE"

# Perform backup
PGPASSWORD="$DB_PASS" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-acl \
    | gzip > "$OUTPUT_DIR/$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(ls -lh "$OUTPUT_DIR/$BACKUP_FILE" | awk '{print $5}')
    echo "Backup completed successfully: $BACKUP_SIZE"
else
    echo "Error: Backup failed"
    exit 1
fi

# Clean up old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$OUTPUT_DIR" -name "ultralytics_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# List current backups
echo ""
echo "Current backups:"
ls -lh "$OUTPUT_DIR"/ultralytics_backup_*.sql.gz 2>/dev/null || echo "No backups found"

echo ""
echo "Backup complete!"
