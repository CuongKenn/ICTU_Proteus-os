// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// AIChatWidget / AIChatPanel — Proteus AI conversation UI (§5.4.5 Design System)
// States: collapsed | expanded | thinking | awaiting_approval
// Tham chiếu: docs/ui_ux_design.md §5.4.5, docs/dsl-spec.md, docs/architecture.md §2.3
//
// SRP: Component chỉ xử lý UI rendering.
// Business logic được tách hoàn toàn vào useAICommand hook (AGENTS.md §8).

"use client";

import React, { useRef, useEffect, KeyboardEvent } from "react";
import {
  Bot,
  X,
  Send,
  Loader2,
  AlertTriangle,
  ExternalLink,
  XCircle,
  ChevronDown,
  Clock,
  Zap,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";
import { useAICommand, ChatMessage, DslPreview } from "@/hooks/useAICommand";
import { logger } from "@/lib/logger";

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Typing indicator — 3 chấm bounce 600ms (§5.6 Animation) */
const ThinkingIndicator: React.FC = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    <span className="text-xs text-text-secondary mr-2">Đang phân tích</span>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-2 h-2 rounded-full bg-accent animate-bounce"
        style={{ animationDelay: `${i * 200}ms`, animationDuration: "600ms" }}
      />
    ))}
  </div>
);

/** Render nội dung tin nhắn với basic markdown bold */
function renderMessageContent(content: string): React.ReactNode {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-semibold text-text-primary">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded bg-bg-base font-mono text-xs text-accent border border-border">
          {part.slice(1, -1)}
        </code>
      );
    }
    // Preserve newlines
    return part.split("\n").map((line, li, arr) => (
      <React.Fragment key={`${idx}-${li}`}>
        {line}
        {li < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  });
}

/** Bubble hiển thị tin nhắn */
const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === "user";
  return (
    <div className={clsx("flex gap-2 mb-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-accent" />
        </div>
      )}

      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-white rounded-tr-sm"
            : "bg-bg-surface border border-border text-text-primary rounded-tl-sm"
        )}
      >
        {renderMessageContent(message.content)}
        <div className={clsx("text-[10px] mt-1 opacity-60", isUser ? "text-right" : "text-left")}>
          {message.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
};

/** Panel hiển thị DSL Preview khi effect=write/critical */
const DslPreviewPanel: React.FC<{
  preview: DslPreview;
  onApprove: () => void;
  onCancel: () => void;
}> = ({ preview, onApprove, onCancel }) => {
  const deadline = new Date(preview.approval_deadline);
  const isWrite = preview.effect === "write";

  return (
    <div className="mx-3 mb-3 rounded-xl border border-warning/40 bg-warning/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-warning/10 border-b border-warning/20">
        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
        <span className="text-xs font-semibold text-warning">Chờ phê duyệt Mattermost</span>
        <span
          className={clsx(
            "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full",
            isWrite
              ? "bg-warning/20 text-warning"
              : "bg-danger/20 text-danger"
          )}
        >
          {preview.effect.toUpperCase()}
        </span>
      </div>

      {/* Action */}
      <div className="px-3 pt-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3 h-3 text-accent" />
          <span className="text-[11px] text-text-secondary font-mono">{preview.action}</span>
        </div>

        {/* Dry-run preview */}
        {preview.dry_run_result && (
          <div className="mb-2.5">
            <div className="text-[11px] font-medium text-text-secondary mb-1.5">
              Ảnh hưởng đến{" "}
              <span className="text-warning font-bold">
                {preview.dry_run_result.affected_count}
              </span>{" "}
              bản ghi:
            </div>
            <div className="space-y-1 max-h-[80px] overflow-y-auto">
              {preview.dry_run_result?.preview?.slice(0, 3).map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[11px] text-text-secondary"
                >
                  <span className="w-1 h-1 rounded-full bg-warning/60 shrink-0" />
                  <span>{String(item.employee_name || item.id || JSON.stringify(item))}</span>
                </div>
              ))}
              {(preview.dry_run_result?.preview?.length || 0) > 3 && (
                <div className="text-[10px] text-text-disabled pl-2.5">
                  +{(preview.dry_run_result?.preview?.length || 0) - 3} bản ghi khác…
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deadline */}
        <div className="flex items-center gap-1 text-[10px] text-text-disabled mb-3">
          <Clock className="w-3 h-3" />
          Hết hạn:{" "}
          {deadline.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-3 pb-3">
        <button
          id="ai-widget-approve-mattermost-btn"
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-warning text-white text-xs font-semibold hover:bg-yellow-500 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Phê duyệt trên Mattermost
        </button>
        <button
          id="ai-widget-cancel-approval-btn"
          onClick={onCancel}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-bg-surface border border-border text-xs text-text-secondary hover:bg-bg-hover hover:text-danger transition-colors"
        >
          <XCircle className="w-3.5 h-3.5" />
          Huỷ
        </button>
      </div>
    </div>
  );
};

// ─── Main Chat Components ─────────────────────────────────────────────────────

interface AIChatSurfaceProps {
  mode: "floating" | "page";
}

const AIChatSurface: React.FC<AIChatSurfaceProps> = ({ mode }) => {
  const {
    widgetState,
    messages,
    inputValue,
    dslPreview,
    sessionId,
    setInputValue,
    openWidget,
    minimizeWidget,
    resetAndClose,
    clearHistory,
    sendCommand,
    openMattermostApproval,
    cancelApproval,
  } = useAICommand();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isPage = mode === "page";
  const isExpanded = isPage || widgetState !== "collapsed";

  // Auto-scroll khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, widgetState]);

  // Focus input khi mở
  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isExpanded]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCommand();
    } else if (!isPage && e.key === "Escape") {
      e.preventDefault();
      minimizeWidget();
    }
  };

  // Global Keyboard listener for Ctrl+K
  useEffect(() => {
    if (isPage) return;

    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isExpanded) {
          minimizeWidget();
        } else {
          openWidget();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isPage, isExpanded, openWidget, minimizeWidget]);

  const isInputDisabled = widgetState === "thinking" || widgetState === "awaiting_approval";
  const canSend = inputValue.trim().length > 0 && !isInputDisabled;
  const statusText =
    widgetState === "thinking"
      ? "Đang xử lý..."
      : widgetState === "awaiting_approval"
      ? "Chờ phê duyệt"
      : "Sẵn sàng";
  const statusDotClass = widgetState === "thinking" ? "bg-warning animate-pulse" : "bg-success";

  const chatHeader = (
    <div
      className={clsx(
        "flex items-center justify-between border-b border-border bg-bg-surface/50 shrink-0",
        isPage ? "min-h-[68px] px-4 py-3 sm:px-6" : "h-[52px] px-4"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={clsx(
            "rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0",
            isPage ? "w-9 h-9" : "w-8 h-8"
          )}
        >
          <Bot className={clsx("text-accent", isPage ? "w-5 h-5" : "w-4 h-4")} />
        </div>
        <div className="min-w-0">
          <div className={clsx("font-semibold text-text-primary leading-tight", isPage ? "text-base" : "text-sm")}>
            Proteus AI
          </div>
          <div className="flex items-center gap-1">
            <span className={clsx("w-1.5 h-1.5 rounded-full", statusDotClass)} />
            <span className="text-[10px] text-text-secondary">{statusText}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          id="ai-widget-clear-btn"
          aria-label="Xóa lịch sử trò chuyện"
          onClick={clearHistory}
          className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
          title="Xóa lịch sử trò chuyện"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {!isPage && (
          <>
            <button
              id="ai-widget-minimize-btn"
              aria-label="Thu nhỏ widget"
              onClick={minimizeWidget}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              id="ai-widget-close-btn"
              aria-label="Đóng widget"
              onClick={resetAndClose}
              className="p-1.5 rounded-lg text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  const chatMessages = (
    <div
      id="ai-chat-messages"
      role="log"
      aria-live="polite"
      aria-atomic="false"
      aria-label="Lịch sử hội thoại với Proteus AI"
      className={clsx("flex-1 overflow-y-auto", isPage ? "px-4 py-5 sm:px-6" : "px-3 pt-3")}
    >
      <div className={clsx(isPage && "mx-auto w-full max-w-4xl")}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {widgetState === "thinking" && (
          <div aria-hidden="true">
            <ThinkingIndicator />
          </div>
        )}

        {widgetState === "awaiting_approval" && dslPreview && (
          <DslPreviewPanel
            preview={dslPreview}
            onApprove={openMattermostApproval}
            onCancel={cancelApproval}
          />
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );

  const chatInput = (
    <div
      className={clsx(
        "border-t border-border flex items-center gap-2 bg-bg-surface/30 shrink-0",
        isPage ? "px-4 py-3 sm:px-6" : "h-[64px] px-3"
      )}
    >
      <div className={clsx("flex items-center gap-2 w-full", isPage && "mx-auto max-w-4xl")}>
        <textarea
          ref={inputRef}
          id="ai-chat-input"
          rows={1}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isInputDisabled}
          placeholder={
            widgetState === "awaiting_approval"
              ? "Đang chờ phê duyệt…"
              : "Nhập lệnh bằng tiếng Việt… (Enter để gửi)"
          }
          aria-label="Nhập lệnh cho AI"
          className={clsx(
            "flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-disabled",
            "resize-none outline-none leading-5 py-2 max-h-[52px] overflow-y-auto",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        />
        <button
          id="ai-chat-send-btn"
          aria-label="Gửi lệnh"
          onClick={sendCommand}
          disabled={!canSend}
          className={clsx(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200",
            canSend
              ? "bg-primary hover:bg-primary-hover text-white shadow-[0_0_12px_hsla(245,85%,65%,0.4)]"
              : "bg-bg-hover text-text-disabled cursor-not-allowed"
          )}
        >
          {widgetState === "thinking" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );

  if (isPage) {
    return (
      <section
        id="ai-chat-page"
        role="region"
        className="h-full min-h-0 flex flex-col bg-bg-base"
        aria-label="Proteus AI"
      >
        {chatHeader}
        {chatMessages}
        {chatInput}
      </section>
    );
  }

  return (
    <div
      id="ai-chat-widget-root"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3"
      role="complementary"
      aria-label="Proteus AI Chat"
    >
      {/* ── Chat Panel (expanded / thinking / awaiting_approval) ── */}
      <div
        id="ai-chat-panel"
        aria-hidden={!isExpanded}
        className={clsx(
          "w-[420px] sm:w-[480px] rounded-2xl border border-border overflow-hidden",
          "bg-bg-glass backdrop-blur-[16px]",
          "shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(108,99,255,0.1)]",
          "transition-all duration-300 ease-out origin-bottom-right",
          "flex flex-col",
          isExpanded
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4 pointer-events-none"
        )}
        style={{ height: isExpanded ? "600px" : "0px" }}
      >
        {chatHeader}
        {chatMessages}
        {chatInput}
      </div>

      {/* ── Floating Button (always visible) ── */}
      <button
        id="ai-widget-fab"
        aria-label={isExpanded ? "Thu nhỏ Proteus AI" : "Mở Proteus AI"}
        aria-expanded={isExpanded}
        title={isExpanded ? "Thu nhỏ" : "Mở Proteus AI (Ctrl+K)"}
        onClick={isExpanded ? resetAndClose : openWidget}
        className={clsx(
          "w-16 h-16 rounded-2xl flex items-center justify-center",
          "transition-all duration-300 ease-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base",
          isExpanded
            ? [
                "bg-bg-surface border border-border text-text-secondary",
                "hover:bg-bg-hover hover:text-danger",
                "shadow-lg",
              ]
            : [
                "bg-gradient-to-br from-accent to-primary text-white",
                "shadow-[0_4px_24px_hsla(280,80%,65%,0.45)]",
                "hover:shadow-[0_6px_32px_hsla(280,80%,65%,0.65)]",
                "hover:scale-105 active:scale-95",
              ]
        )}
      >
        {isExpanded ? (
          <ChevronDown className="w-6 h-6" />
        ) : (
          <div className="relative">
            <Bot className="w-7 h-7" />
          </div>
        )}
      </button>
    </div>
  );
};

// ─── Error Boundary ───────────────────────────────────────────────────────────

class AIChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("AIChatWidget Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed bottom-6 right-6 z-[9999] w-[300px] rounded-2xl border border-danger/20 bg-bg-surface flex flex-col items-center justify-center gap-2 p-6 shadow-xl">
          <AlertTriangle className="w-8 h-8 text-danger mb-1" />
          <div className="text-sm text-text-primary font-semibold text-center">AI Chat gặp lỗi</div>
          <div className="text-xs text-text-secondary text-center mb-2">Đã có lỗi xảy ra trong quá trình hiển thị.</div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-bg-hover text-text-primary rounded-lg text-xs font-medium hover:bg-border transition-colors"
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AIChatWidget: React.FC = () => (
  <AIChatErrorBoundary>
    <AIChatSurface mode="floating" />
  </AIChatErrorBoundary>
);

export const AIChatPanel: React.FC = () => (
  <AIChatErrorBoundary>
    <AIChatSurface mode="page" />
  </AIChatErrorBoundary>
);
