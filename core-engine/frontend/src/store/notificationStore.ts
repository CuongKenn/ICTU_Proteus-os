// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

export interface NotificationItem extends ToastMessage {
  createdAt: Date;
  isRead: boolean;
}

interface NotificationState {
  toasts: ToastMessage[];
  notifications: NotificationItem[];
  unreadCount: number;
  addToast: (type: ToastType, message: string, duration?: number, title?: string) => void;
  removeToast: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  notifications: [],
  unreadCount: 0,
  addToast: (type, message, duration = 5000, title) => {
    const id = typeof crypto !== "undefined" && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 15);
    
    set((state) => {
      const newNotif: NotificationItem = { id, type, message, title, createdAt: new Date(), isRead: false };
      const updatedNotifications = [newNotif, ...state.notifications].slice(0, 50); // Keep last 50
      return {
        toasts: [...state.toasts, { id, type, message, title }],
        notifications: updatedNotifications,
        unreadCount: updatedNotifications.filter(n => !n.isRead).length
      };
    });

    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      unreadCount: 0
    })),
  clearNotifications: () =>
    set({ notifications: [], unreadCount: 0 }),
}));
