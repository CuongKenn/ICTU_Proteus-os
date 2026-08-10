// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { CheckCircle, AlertTriangle, XCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastProps {
  type: ToastType;
  message: string;
  title?: string;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ type, message, title, onClose }) => {
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    // Trigger slide in
    const timer = requestAnimationFrame(() => setIsShowing(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const icons = {
    success: <CheckCircle className="text-success w-5 h-5" />,
    error: <XCircle className="text-danger w-5 h-5" />,
    warning: <AlertTriangle className="text-warning w-5 h-5" />,
    info: <Info className="text-primary w-5 h-5" />,
  };

  const borders = {
    success: "border-success/30 bg-success/5",
    error: "border-danger/30 bg-danger/5",
    warning: "border-warning/30 bg-warning/5",
    info: "border-primary/30 bg-primary/5",
  };

  return (
    <div
      className={clsx(
        "glass-card border flex items-start gap-3 p-4 min-w-[300px] max-w-sm shadow-xl transition-all duration-300 ease-out",
        borders[type],
        isShowing ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      )}
    >
      <div className="shrink-0 mt-0.5">{icons[type]}</div>
      <div className="flex-1 min-w-0">
        {title && <h4 className="text-sm font-semibold text-text-primary mb-1">{title}</h4>}
        <p className="text-sm text-text-secondary leading-tight">{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className="shrink-0 text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-bg-glass transition-colors">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
