#!/bin/bash
# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Script phục hồi CSDL PostgreSQL từ file sao lưu

if [ -z "$1" ]; then
    echo "Usage: ./restore_backup.sh <path_to_backup_file.sql.gz>"
    echo "Ví dụ: ./restore_backup.sh ./backups/postgres/proteus_backup_2026-09-06.sql.gz"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "File ${BACKUP_FILE} không tồn tại!"
    exit 1
fi

echo "⚠️  CẢNH BÁO: Việc này sẽ ghi đè toàn bộ dữ liệu hiện tại trong database 'proteus'."
read -p "Bạn có chắc chắn muốn tiếp tục? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Đã hủy."
    exit 1
fi

echo "Bắt đầu phục hồi CSDL từ file ${BACKUP_FILE}..."

# Giải nén và đẩy vào container postgres đang chạy
# Giả sử file script này được chạy ở thư mục deploy/ (chứa docker-compose.yml)
gunzip -c "${BACKUP_FILE}" | docker compose exec -T postgres psql -U proteus -d proteus

if [ $? -eq 0 ]; then
    echo "✅ Phục hồi CSDL thành công!"
else
    echo "❌ Có lỗi xảy ra trong quá trình phục hồi."
    exit 1
fi
