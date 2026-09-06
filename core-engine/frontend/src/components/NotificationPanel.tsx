// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useRef, useEffect, useState } from "react";
import { Bell, CheckCircle2, XCircle, Info, AlertTriangle, Check, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { useNotificationStore, NotificationItem } from "@/store/notificationStore";

const formatTimeAgo = (date: Date) => {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
};

const getIcon = (type: string) => {
  switch (type) {
    case "success": return <CheckCircle2 className="w-5 h-5 text-success" />;
    case "error": return <XCircle className="w-5 h-5 text-danger" />;
    case "warning": return <AlertTriangle className="w-5 h-5 text-warning" />;
    default: return <Info className="w-5 h-5 text-brand-primary" />;
  }
};

export const NotificationPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const { notifications, unreadCount, markAllAsRead, clearNotifications } = useNotificationStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      <button 
        className="relative p-2 text-text-secondary hover:bg-bg-hover rounded-full transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="Thông báo"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-bg-base">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-bg-surface-elevated shadow-xl overflow-hidden z-50 flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-surface shrink-0">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              Thông báo
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs bg-brand-primary/10 text-brand-primary rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </h3>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="p-1.5 text-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 rounded-md transition-colors"
                  title="Đánh dấu đã đọc tất cả"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button 
                  onClick={clearNotifications}
                  className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                  title="Xoá tất cả"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-[100px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-text-muted">
                <Bell className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-sm">Không có thông báo nào</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border/50">
                {notifications.map((n: NotificationItem) => (
                  <div 
                    key={n.id} 
                    className={clsx(
                      "flex gap-3 p-4 hover:bg-bg-hover transition-colors",
                      !n.isRead && "bg-brand-primary/5"
                    )}
                  >
                    <div className="shrink-0 mt-0.5">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {n.title && (
                        <p className={clsx("text-sm font-semibold truncate", !n.isRead ? "text-text-primary" : "text-text-secondary")}>
                          {n.title}
                        </p>
                      )}
                      <p className={clsx("text-sm leading-relaxed", !n.isRead ? "text-text-primary" : "text-text-secondary")}>
                        {n.message}
                      </p>
                      <p className="text-xs text-text-muted mt-1.5 font-medium">
                        {formatTimeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.isRead && (
                      <div className="shrink-0 w-2 h-2 rounded-full bg-brand-primary mt-1.5" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Footer (Optional) */}
          <div className="border-t border-border p-2 bg-bg-surface/50 text-center shrink-0">
            <span className="text-xs text-text-muted">Chỉ hiển thị 50 thông báo gần nhất</span>
          </div>
        </div>
      )}
    </div>
  );
};
