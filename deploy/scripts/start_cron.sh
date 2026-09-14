#!/bin/sh
# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
# Script khởi chạy crond bên trong container postgres-backup

# Khởi tạo crontab — chạy backup vào 2:00 AM mỗi ngày.
# Portable trên cả Alpine (busybox crond + /etc/crontabs) và Debian
# (cron + /etc/cron.d, hoặc không có cron daemon → fallback vòng lặp sleep).
chmod +x /scripts/backup_postgres.sh 2>/dev/null || true
CRON_EXPR="0 2 * * * /scripts/backup_postgres.sh"

if command -v crond >/dev/null 2>&1; then
  mkdir -p /etc/crontabs
  echo "$CRON_EXPR" > /etc/crontabs/root
  echo "Crond started. Backup scheduled at 02:00 AM daily."
  exec crond -f -d 8
elif command -v cron >/dev/null 2>&1; then
  mkdir -p /etc/cron.d
  echo "$CRON_EXPR root" > /etc/cron.d/proteus-backup
  chmod 0644 /etc/cron.d/proteus-backup
  echo "Cron started. Backup scheduled at 02:00 AM daily."
  exec cron -f
else
  echo "WARN: no crond/cron found — fallback to sleep loop (backup daily at 02:00)."
  while true; do
    _now_hm=$(date +%H:%M)
    if [ "$_now_hm" = "02:00" ]; then
      /scripts/backup_postgres.sh || true
      sleep 61
    else
      sleep 30
    fi
  done
fi
