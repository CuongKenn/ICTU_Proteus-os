#!/bin/sh
# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
# Script khởi chạy crond bên trong container postgres-backup

# Khởi tạo crontab
# Chạy vào 2:00 AM mỗi ngày
echo "0 2 * * * /scripts/backup_postgres.sh" > /etc/crontabs/root

# Chạy backup lần đầu tiên ngay khi khởi động để đảm bảo script hoạt động (Tùy chọn, comment lại nếu không muốn)
# /scripts/backup_postgres.sh

echo "Crond started. Backup scheduled at 02:00 AM daily."

# Khởi động crond ở foreground (-f)
exec crond -f -d 8
