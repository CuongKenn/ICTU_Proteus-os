// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  /** Optional confirm action */
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmVariant?: string;
  isConfirmLoading?: boolean;
  /** If set, user must type this keyword to enable confirm */
  confirmKeyword?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "480px",
  onConfirm,
  confirmLabel = "Xác nhận",
  confirmVariant = "accent",
  isConfirmLoading = false,
  confirmKeyword,
}) => {
  const [keywordInput, setKeywordInput] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) setKeywordInput("");
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const isConfirmEnabled = confirmKeyword ? keywordInput === confirmKeyword : true;

  const btnClass = confirmVariant === "danger" ? "btn-danger" : "btn-accent";

  // Hỗ trợ cả named size của Tailwind ("sm","2xl"...) lẫn giá trị CSS ("480px").
  // Trước đây truyền "2xl" bị đưa thẳng vào style.maxWidth → invalid → modal mất
  // giới hạn bề rộng, kéo full màn hình.
  const NAMED_SIZE_CLASS: Record<string, string> = {
    xs: "max-w-xs",
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
    full: "max-w-full",
    "screen-sm": "max-w-screen-sm",
    "screen-md": "max-w-screen-md",
    "screen-lg": "max-w-screen-lg",
    "screen-xl": "max-w-screen-xl",
    "screen-2xl": "max-w-screen-2xl",
  };
  const sizeClass = NAMED_SIZE_CLASS[maxWidth];

  // Portal ra document.body: tránh bị ancestor có `overflow:hidden`/`transform`
  // (vd .card trong Settings) làm containing block, khiến modal bị cắt/can thiệp.
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Modal Card */}
      <div
        className={`relative w-full rounded-2xl animate-scale-in flex flex-col max-h-[90vh] ${sizeClass ?? ""}`}
        style={{
          ...(sizeClass ? {} : { maxWidth }),
          background: "var(--paper-white)",
          border: "1px solid var(--line-hi)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
          <h2 className="text-lg font-grot font-semibold" style={{ color: "var(--ink)" }}>{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--dim)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--dim)")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto" style={{ color: "var(--ink-soft)" }}>
          {children}
        </div>

        {/* Footer — only if onConfirm is provided */}
        {onConfirm && (
          <div className="px-6 py-4 flex items-center justify-end gap-3 shrink-0" style={{ borderTop: "1px solid var(--line)" }}>
            {confirmKeyword && (
              <div className="flex-1">
                <p className="text-xs mb-1.5" style={{ color: "var(--dim)" }}>
                  Nhập <strong style={{ color: "var(--ink)" }}>{confirmKeyword}</strong> để xác nhận:
                </p>
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  className="input-field text-sm"
                  placeholder={confirmKeyword}
                />
              </div>
            )}
            <button onClick={onClose} className="btn-ghost">Hủy</button>
            <button
              onClick={onConfirm}
              disabled={!isConfirmEnabled || isConfirmLoading}
              className={btnClass}
              style={!isConfirmEnabled ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            >
              {isConfirmLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
