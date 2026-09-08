#!/bin/bash
# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Script thực thi sao lưu dữ liệu PostgreSQL tự động

# Load biến môi trường (Script này sẽ được gọi bên trong container đã được inject env vars, nhưng có thể đọc trực tiếp nếu cần)
# Thiết lập các biến mặc định
BACKUP_DIR=${BACKUP_DIR:-"/backups"}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
POSTGRES_HOST=${POSTGRES_HOST:-"postgres"}
POSTGRES_USER=${POSTGRES_USER:-"proteus"}
POSTGRES_DB=${POSTGRES_DB:-"proteus"}
MATTERMOST_WEBHOOK_URL=${MATTERMOST_WEBHOOK_URL:-""}

# Tạo thư mục backup nếu chưa tồn tại
mkdir -p "${BACKUP_DIR}"

DATE=$(date +"%Y-%m-%d")
BACKUP_FILE="${BACKUP_DIR}/proteus_backup_${DATE}.sql.gz"

echo "Starting backup of database ${POSTGRES_DB} to ${BACKUP_FILE}..."

export PGPASSWORD=${POSTGRES_PASSWORD}

# Thực thi pg_dumpall và nén gzip để sao lưu TOÀN BỘ các CSDL
if pg_dumpall -h "${POSTGRES_HOST}" -U "${POSTGRES_USER}" | gzip > "${BACKUP_FILE}"; then
    echo "Backup completed successfully."
    
    # Xóa các file cũ
    echo "Cleaning up old backups (older than ${BACKUP_RETENTION_DAYS} days)..."
    find "${BACKUP_DIR}" -name "proteus_backup_*.sql.gz" -type f -mtime +${BACKUP_RETENTION_DAYS} -delete
    
    # Gửi webhook thành công
    if [ -n "${MATTERMOST_WEBHOOK_URL}" ] && [[ "${MATTERMOST_WEBHOOK_URL}" != *"CHANGE_ME"* ]]; then
        curl -i -X POST -H 'Content-Type: application/json' -d '{"text": "✅ **[Proteus OS]** Backup CSDL PostgreSQL thành công! File: `'"$(basename ${BACKUP_FILE})"'\`"}' "${MATTERMOST_WEBHOOK_URL}" || true
    fi
else
    echo "Backup failed!"
    # Gửi webhook thất bại
    if [ -n "${MATTERMOST_WEBHOOK_URL}" ] && [[ "${MATTERMOST_WEBHOOK_URL}" != *"CHANGE_ME"* ]]; then
        curl -i -X POST -H 'Content-Type: application/json' -d '{"text": "❌ **[Proteus OS] ALERT:** Sao lưu CSDL PostgreSQL THẤT BẠI lúc '"$(date +"%Y-%m-%d %H:%M:%S")"'. Vui lòng kiểm tra ngay!"}' "${MATTERMOST_WEBHOOK_URL}" || true
    fi
    exit 1
fi
