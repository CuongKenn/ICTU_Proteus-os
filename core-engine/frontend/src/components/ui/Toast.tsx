// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  id?: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
  onDismiss?: (id: string) => void;
  onClose?: () => void;
}

const TOAST_CONFIG: Record<ToastType, { icon: React.ElementType; color: string; fill: string }> = {
  success: { icon: CheckCircle2, color: "var(--emerald)", fill: "var(--emerald-fill)" },
  error: { icon: AlertCircle, color: "var(--rose)", fill: "var(--rose-fill)" },
  warning: { icon: AlertTriangle, color: "var(--amber)", fill: "var(--amber-fill)" },
  info: { icon: Info, color: "var(--accent)", fill: "var(--accent-soft)" },
};

export const Toast: React.FC<ToastProps> = ({ id, type, message, title, duration = 5000, onDismiss, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const config = TOAST_CONFIG[type];
  const Icon = config.icon;

  const handleClose = () => {
    if (onDismiss && id) onDismiss(id);
    if (onClose) onClose();
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        if (onDismiss && id) onDismiss(id);
        if (onClose) onClose();
      }, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-300"
      style={{
        background: "var(--paper-white)",
        border: `1px solid var(--line-hi)`,
        boxShadow: "var(--shadow-elevated)",
        borderLeft: `3px solid ${config.color}`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateX(0)" : "translateX(20px)",
      }}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: config.color }} />
      <p className="text-sm flex-1" style={{ color: "var(--ink-soft)" }}>{message}</p>
      <button
        onClick={handleClose}
        className="shrink-0 p-0.5 rounded transition-colors"
        style={{ color: "var(--dim)" }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
