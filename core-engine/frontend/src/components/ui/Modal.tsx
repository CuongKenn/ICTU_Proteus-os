// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { Button } from "./Button";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  confirmKeyword?: string;
  onConfirm?: () => void;
  confirmLabel?: string;
  confirmVariant?: "primary" | "danger";
  isConfirmLoading?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  children,
  onClose,
  confirmKeyword,
  onConfirm,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  isConfirmLoading = false,
}) => {
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Allow DOM to mount before animating in
      const timer = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 250); // match duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset input when closed
  useEffect(() => {
    if (!isOpen) {
      setKeywordInput("");
    }
  }, [isOpen]);

  // Bổ sung lắng nghe phím Escape để đóng Modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isRendered) return null;

  const canConfirm = !confirmKeyword || keywordInput === confirmKeyword;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className={clsx(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-[250ms]",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      
      {/* Modal Dialog */}
      <div 
        className={clsx(
          "relative w-full max-w-md glass-card bg-bg-surface/90 p-6 flex flex-col gap-4 shadow-2xl transition-all duration-[250ms] ease-out",
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">{title}</h2>
          <button 
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-bg-glass transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm text-text-secondary leading-relaxed">
          {children}
        </div>

        {confirmKeyword && (
          <div className="mt-2">
            <label className="block text-xs font-semibold text-text-secondary mb-2">
              Vui lòng gõ <strong>{confirmKeyword}</strong> để xác nhận.
            </label>
            <input
              type="text"
              className="w-full bg-bg-base border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder={confirmKeyword}
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          {onConfirm && (
            <Button 
              variant={confirmVariant} 
              onClick={onConfirm} 
              disabled={!canConfirm}
              isLoading={isConfirmLoading}
            >
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
