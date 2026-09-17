// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { Bell, Check, X } from "lucide-react";
import { useNotificationStore } from "@/store/notificationStore";

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const { notifications, markAllAsRead } = useNotificationStore();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div
      className="w-80 rounded-xl animate-scale-in origin-top-right"
      style={{ background: "var(--paper-white)", border: "1px solid var(--line-hi)", boxShadow: "var(--shadow-elevated)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Thông báo</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: "var(--accent)" }}>
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="p-1 rounded transition-colors"
              style={{ color: "var(--dim)" }}
              title="Đánh dấu tất cả đã đọc"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded transition-colors" style={{ color: "var(--dim)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-[360px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-10 text-center" style={{ color: "var(--dim)" }}>
            <Bell className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Không có thông báo nào</p>
          </div>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <div
              key={n.id}
              className="px-4 py-3 cursor-pointer transition-colors"
              style={{
                borderBottom: "1px solid var(--line)",
                background: n.isRead ? "transparent" : "var(--accent-soft)",
              }}
            >
              <p className="text-[13px] leading-relaxed" style={{ color: n.isRead ? "var(--muted)" : "var(--ink)" }}>
                {n.message}
              </p>
              <span className="font-mono text-[10px] mt-1 block" style={{ color: "var(--dim)" }}>
                {new Date(n.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
