// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// AIChatWidget — Floating AI Chat Widget (§5.4.5 Design System)
// States: collapsed | expanded | thinking | awaiting_approval
// Tham chiếu: docs/ui_ux_design.md §5.4.5, docs/dsl-spec.md, docs/architecture.md §2.3
//
// SRP: Component chỉ xử lý UI rendering.
// Business logic được tách hoàn toàn vào useAICommand hook (AGENTS.md §8).

"use client";

import React, { useRef, useEffect, useState, KeyboardEvent } from "react";
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
  History,
  Plus,
  MessageSquare,
} from "lucide-react";
import { clsx } from "clsx";
import { useAICommand, ChatMessage, ChatSession, DslPreview } from "@/hooks/useAICommand";
import { logger } from "@/lib/logger";

// ─── History list (dùng chung cho widget nổi và trang /ai) ─────────────────

/** Danh sách đoạn chat đã lưu server-side (ai_sessions). */
const HistoryList: React.FC<{
  sessions: ChatSession[];
  activeId: string;
  loading: boolean;
  onSwitch: (id: string) => void;
  onNew: () => void;
}> = ({ sessions, activeId, loading, onSwitch, onNew }) => (
  <div className="flex flex-col h-full">
    <button
      onClick={onNew}
      className="mx-3 mt-3 mb-2 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: "var(--accent)" }}
    >
      <Plus className="w-3.5 h-3.5" />
      Đoạn chat mới
    </button>
    <div className="flex-1 overflow-y-auto px-2 pb-2">
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-text-disabled" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-center text-xs text-text-disabled py-6 px-3">
          Chưa có lịch sử. Đoạn chat hiện tại sẽ tự lưu sau tin nhắn đầu tiên.
        </p>
      ) : (
        sessions.map((s) => {
          const isActive = s.id === activeId;
          return (
            <button
              key={s.id}
              onClick={() => onSwitch(s.id)}
              className={clsx(
                "w-full text-left px-3 py-2 rounded-xl mb-1 transition-colors",
                isActive ? "bg-accent/10" : "hover:bg-bg-hover"
              )}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-text-disabled" />
                <span className="flex-1 min-w-0 truncate text-xs font-medium text-text-primary">
                  {s.title || "Đoạn chat không tên"}
                </span>
              </div>
              {s.updated_at && (
                <div className="text-[10px] text-text-disabled font-mono mt-0.5 pl-[22px]">
                  {new Date(s.updated_at).toLocaleString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </button>
          );
        })
      )}
    </div>
  </div>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Typing indicator — 3 chấm bounce 600ms (§5.6 Animation) */
const ThinkingIndicator: React.FC = () => (
  <div className="flex items-center gap-1 px-4 py-3">
    <span className="text-xs mr-2 font-mono tracking-wide" style={{ color: 'var(--dim)' }}>Đang phân tích</span>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-2 h-2 rounded-full animate-bounce"
        style={{ background: 'var(--accent)', animationDelay: `${i * 200}ms`, animationDuration: '600ms' }}
      />
    ))}
  </div>
);

/** Render nội dung tin nhắn với basic markdown bold + tự nhận diện link */
const URL_RE = /(https?:\/\/[^\s)]+)/g;

function renderWithLinks(line: string): React.ReactNode {
  const segs = line.split(URL_RE);
  if (segs.length === 1) return line;
  return segs.map((seg, si) =>
    seg.startsWith("http://") || seg.startsWith("https://") ? (
      <a
        key={si}
        href={seg}
        target="_blank"
        rel="noreferrer"
        className="underline break-all"
        style={{ color: "var(--accent)" }}
      >
        {seg}
      </a>
    ) : (
      <React.Fragment key={si}>{seg}</React.Fragment>
    )
  );
}

function renderMessageContent(content: string): React.ReactNode {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded-lg font-mono text-xs" style={{ background: 'var(--plate-soft)', color: 'var(--accent)', border: '1px solid var(--plate-border)' }}>
          {part.slice(1, -1)}
        </code>
      );
    }
    // Preserve newlines
    return part.split("\n").map((line, li, arr) => (
      <React.Fragment key={`${idx}-${li}`}>
        {renderWithLinks(line)}
        {li < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  });
}

/** Bubble hiển thị tin nhắn */
const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === "user";
  const details = !isUser ? message.details : null;
  const hasDetails =
    !!details &&
    ((details.steps?.length || 0) > 0 || (details.thoughts?.length || 0) > 0);
  return (
    <div className={clsx("flex gap-2 mb-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-accent" />
        </div>
      )}

      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-tr-sm font-medium text-white"
            : "border border-line text-ink rounded-tl-sm"
        )}
        style={isUser ? { background: "var(--accent)" } : { background: "var(--paper)" }}
      >
        {renderMessageContent(message.content)}

        {/* Chi tiết các bước ẩn sau click — chỉ hiện output chính */}
        {hasDetails && details && (
          <details className="mt-2 pt-2 border-t border-line">
            <summary className="cursor-pointer select-none font-mono text-[11px] tracking-wide opacity-60 hover:opacity-100 transition-opacity">
              Chi tiết thực hiện
              {(details.steps?.length || 0) > 0 && ` (${details.steps.length} bước)`}
            </summary>
            <div className="mt-1.5 space-y-1.5">
              {(details.steps || []).map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] leading-snug opacity-80">
                  <span
                    className={clsx(
                      "mt-1 w-1.5 h-1.5 rounded-full shrink-0",
                      s.status === "COMPLETED"
                        ? "bg-success"
                        : s.status === "PENDING_APPROVAL"
                        ? "bg-warning"
                        : "bg-danger"
                    )}
                  />
                  <span className="font-mono break-all">
                    {s.action}
                    {s.status !== "COMPLETED" && s.message ? (
                      <span className="opacity-70"> — {s.message}</span>
                    ) : null}
                  </span>
                </div>
              ))}
              {(details.thoughts || []).length > 0 && (
                <div className="text-[11px] italic opacity-60">
                  💭 {details.thoughts[0]}
                </div>
              )}
            </div>
          </details>
        )}

        <div className={clsx("text-[10px] mt-1 opacity-60 font-mono", isUser ? "text-right" : "text-left")}>
          {message.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
};

/** Tên module tiếng Việt từ prefix action (hr → Nhân sự...). */
const PLUGIN_VI: Record<string, string> = {
  hr: "Nhân sự",
  finance: "Tài chính",
  crm: "Khách hàng",
  project: "Dự án",
  meeting: "Cuộc họp",
  document: "Tài liệu",
  procurement: "Mua sắm",
  asset: "Tài sản",
  it: "Hỗ trợ IT",
  helpdesk: "Hỗ trợ IT",
  core: "Hệ thống",
  plugins: "Plugin",
  users: "Người dùng",
  knowledge: "Tri thức",
};

/** Tên hành động tiếng Việt từ đuôi action (approve → Phê duyệt...). */
const ACTION_VI: Record<string, string> = {
  approve: "Phê duyệt",
  batch_approve: "Duyệt hàng loạt",
  reject: "Từ chối",
  create: "Tạo mới",
  update: "Cập nhật",
  delete: "Xóa",
  deactivate: "Vô hiệu hóa",
  install: "Cài đặt",
  search: "Tra cứu",
  list: "Liệt kê",
  read: "Xem",
  report: "Báo cáo",
  reminder: "Nhắc việc",
  booking: "Đặt lịch",
  assignment: "Giao việc",
};

/** "hr.leave_requests.batch_approve" → { title: "Duyệt hàng loạt leave requests", plugin: "Nhân sự" } */
function describeAction(action: string): { title: string; plugin: string } {
  const parts = action.split(".");
  const plugin = PLUGIN_VI[parts[0]] || parts[0] || "Hệ thống";
  const tail = parts[parts.length - 1] || "";
  const verb = ACTION_VI[tail] || tail.replace(/_/g, " ");
  const resource =
    parts.length >= 3 ? parts[parts.length - 2].replace(/_/g, " ") : "";
  return { title: resource ? `${verb} ${resource}` : verb, plugin };
}

/** "Còn ~25 phút (đến 14:30)" từ ISO deadline. */
function relativeDeadline(iso: string): string {
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return "";
  const mins = Math.round((end - Date.now()) / 60000);
  const at = new Date(iso).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (mins <= 0) return `Đã hết hạn (${at})`;
  if (mins < 60) return `Còn ~${mins} phút (đến ${at})`;
  return `Còn ~${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}p` : ""} (đến ${at})`;
}

const PRETTY_KEYS = [
  "employee_name",
  "full_name",
  "name",
  "title",
  "email",
  "employee_code",
  "code",
  "id",
];

/** 1 bản ghi dry-run → tối đa 3 dòng "key: value" gọn (thay vì dump JSON). */
function prettyPreviewItem(item: Record<string, unknown>): string[] {
  if (!item || typeof item !== "object") return [String(item)];
  const entries = Object.entries(item).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  if (entries.length === 0) return ["(bản ghi trống)"];
  const ordered = [
    ...entries.filter(([k]) => PRETTY_KEYS.includes(k)),
    ...entries.filter(([k]) => !PRETTY_KEYS.includes(k)),
  ].slice(0, 3);
  return ordered.map(([k, v]) => {
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return `${k.replace(/_/g, " ")}: ${s.length > 60 ? s.slice(0, 60) + "…" : s}`;
  });
}

/** Card yêu cầu phê duyệt khi effect=write/critical. */
const DslPreviewPanel: React.FC<{
  preview: DslPreview;
  onApprove: () => void;
  onCancel: () => void;
}> = ({ preview, onApprove, onCancel }) => {
  const isCritical = preview.effect === "critical";
  const { title, plugin } = describeAction(preview.action);
  const dry = preview.dry_run_result;
  const previewRows = (dry?.preview || []).slice(0, 3);

  return (
    <div className="mx-3 mb-3 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--line-hi)", background: "var(--paper)" }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5"
        style={{ background: isCritical ? "var(--rose-fill)" : "var(--amber-fill, #fef3c7)", borderBottom: "1px solid var(--line)" }}
      >
        <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: isCritical ? "var(--rose)" : "var(--amber, #d97706)" }} />
        <span className="text-xs font-semibold">
          Yêu cầu phê duyệt
        </span>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
          style={
            isCritical
              ? { background: "var(--rose)", color: "#fff" }
              : { background: "var(--accent)", color: "#fff" }
          }
        >
          {isCritical ? "Cần 2 người duyệt" : "Cần 1 người duyệt"}
        </span>
      </div>

      <div className="px-3.5 py-3 space-y-2.5">
        {/* Việc cần làm */}
        <div>
          <div className="text-sm font-semibold text-text-primary capitalize">{title}</div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-accent/10 text-accent font-medium">
              {plugin}
            </span>
            <span className="font-mono text-[10px] text-text-disabled">{preview.action}</span>
          </div>
        </div>

        {/* Mô tả */}
        {preview.approval_message && preview.approval_message !== "Không có mô tả" && (
          <p className="text-xs text-text-secondary leading-relaxed">
            {preview.approval_message}
          </p>
        )}

        {/* Ảnh hưởng */}
        {dry && (
          <div className="rounded-xl px-3 py-2" style={{ background: "var(--paper-raised)", border: "1px solid var(--line)" }}>
            {dry.unknown_scope ? (
              <div className="text-[11px] text-text-secondary leading-relaxed">
                Chưa xác định được số bản ghi ảnh hưởng với loại workflow này
                {dry.message ? ` (${dry.message})` : ""} — xem chi tiết luồng
                trước khi duyệt.
              </div>
            ) : (
            <div className="text-[11px] font-semibold text-text-primary mb-1">
              Ảnh hưởng{" "}
              <span style={{ color: "var(--accent)" }}>{dry.affected_count}</span>{" "}
              bản ghi
              {dry.message ? (
                <span className="font-normal text-text-disabled"> — {dry.message}</span>
              ) : null}
            </div>
            )}
            {previewRows.length > 0 && (
              <div className="space-y-1">
                {previewRows.map((item, i) => (
                  <div key={i} className="text-[11px] text-text-secondary leading-snug">
                    <span className="mr-1.5" style={{ color: "var(--accent)" }}>•</span>
                    {prettyPreviewItem(item).join(" · ")}
                  </div>
                ))}
                {(dry.preview?.length || 0) > 3 && (
                  <div className="text-[10px] text-text-disabled font-mono">
                    +{(dry.preview?.length || 0) - 3} bản ghi khác…
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Hạn duyệt */}
        <div className="flex items-center gap-1.5 text-[11px] text-text-disabled">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {relativeDeadline(preview.approval_deadline)}
          <span className="font-mono">· tự cập nhật tại đây</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-3.5 pb-3.5">
        <button
          id="ai-widget-approve-mattermost-btn"
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-xs font-bold hover:opacity-90 transition-opacity"
          style={{ background: "var(--accent)" }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Mở Mattermost để duyệt
        </button>
        <button
          id="ai-widget-cancel-approval-btn"
          onClick={onCancel}
          className="flex items-center justify-center gap-1 px-3.5 py-2.5 rounded-xl border border-line text-xs text-muted hover:bg-bg-hover hover:text-danger transition-colors"
        >
          <XCircle className="w-3.5 h-3.5" />
          Hủy lệnh
        </button>
      </div>
    </div>
  );
};

// ─── Main Widget Component ────────────────────────────────────────────────────

const AIChatWidgetInner: React.FC = () => {
  const {
    widgetState,
    messages,
    inputValue,
    dslPreview,
    sessionId,
    sessions,
    historyLoading,
    setInputValue,
    openWidget,
    minimizeWidget,
    resetAndClose,
    sendCommand,
    openMattermostApproval,
    cancelApproval,
    loadSessions,
    switchSession,
    newChat,
  } = useAICommand();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isExpanded = widgetState !== "collapsed";
  const [showHistory, setShowHistory] = useState(false);

  const toggleHistory = () => {
    if (!showHistory) loadSessions();
    setShowHistory((v) => !v);
  };

  // Auto-scroll khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, widgetState]);

  // Focus input khi mở widget
  useEffect(() => {
    if (widgetState === "expanded") {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [widgetState]);

  // Gửi khi bấm Enter (Shift+Enter = xuống dòng)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCommand();
    } else if (e.key === "Escape") {
      e.preventDefault();
      minimizeWidget();
    }
  };

  // Global Keyboard listener for Ctrl+K
  useEffect(() => {
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
  }, [isExpanded, openWidget, minimizeWidget]);

  const isInputDisabled = widgetState === "thinking" || widgetState === "awaiting_approval";
  const canSend = inputValue.trim().length > 0 && !isInputDisabled;

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
          "w-[360px] rounded-2xl overflow-hidden relative",
          "shadow-modal",
          "transition-all duration-300 ease-out origin-bottom-right",
          "flex flex-col",
          isExpanded
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4 pointer-events-none"
        )}
        style={{ height: isExpanded ? '480px' : '0px', background: 'var(--paper-white)', border: '1px solid var(--line-hi)' }}
      >
        {/* Header */}
        <div className="h-[52px] flex items-center justify-between px-4 shrink-0" style={{ borderBottom: '1px solid var(--line)', background: 'var(--paper-raised)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-glow)' }}>
              <Bot className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-text-primary leading-tight font-heading">Proteus AI</div>
              <div className="flex items-center gap-1">
                <span
                  className={clsx(
                    "w-1.5 h-1.5 rounded-full",
                    widgetState === "thinking" ? "bg-warning animate-pulse" : "bg-success"
                  )}
                />
                <span className="text-[10px] text-text-secondary font-mono tracking-wide">
                  {widgetState === "thinking"
                    ? "PROCESSING"
                    : widgetState === "awaiting_approval"
                    ? "PENDING"
                    : "ONLINE"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              id="ai-widget-history-btn"
              aria-label="Lịch sử chat"
              title="Lịch sử chat"
              onClick={toggleHistory}
              className="p-1.5 rounded-xl text-text-disabled hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              id="ai-widget-minimize-btn"
              aria-label="Thu nhỏ widget"
              onClick={minimizeWidget}
              className="p-1.5 rounded-xl text-text-disabled hover:text-text-primary hover:bg-bg-hover transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              id="ai-widget-close-btn"
              aria-label="Đóng widget"
              onClick={resetAndClose}
              className="p-1.5 rounded-xl text-text-disabled hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* History overlay */}
        {showHistory && (
          <div className="absolute inset-x-0 top-[52px] bottom-[64px] z-10" style={{ background: "var(--paper-white)" }}>
            <HistoryList
              sessions={sessions}
              activeId={sessionId}
              loading={historyLoading}
              onSwitch={async (id) => {
                await switchSession(id);
                setShowHistory(false);
              }}
              onNew={() => {
                newChat();
                setShowHistory(false);
              }}
            />
          </div>
        )}

        {/* Messages Area */}
        <div
          id="ai-chat-messages"
          role="log"
          aria-live="polite"
          aria-atomic="false"
          aria-label="Lịch sử hội thoại với Proteus AI"
          className="flex-1 overflow-y-auto px-3 pt-3"
        >
          {historyLoading && messages.length <= 1 && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-text-disabled">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Đang tải lịch sử…
            </div>
          )}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Thinking state */}
          {widgetState === "thinking" && (
            <div aria-hidden="true">
              <ThinkingIndicator />
            </div>
          )}

          {/* DSL Preview Panel */}
          {widgetState === "awaiting_approval" && dslPreview && (
            <DslPreviewPanel
              preview={dslPreview}
              onApprove={openMattermostApproval}
              onCancel={cancelApproval}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="h-[64px] px-3 flex items-center gap-2 shrink-0" style={{ borderTop: '1px solid var(--line)', background: 'var(--paper-raised)' }}>
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
                ? "text-white shadow-elevated"
                : "cursor-not-allowed"
            )}
            style={{
              background: canSend ? 'var(--accent)' : 'var(--paper)',
              color: canSend ? 'white' : 'var(--dim)',
            }}
          >
            {widgetState === "thinking" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
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
          "focus:outline-none focus-visible:ring-2",
          isExpanded
            ? [
                "hover:text-danger",
                "shadow-lg",
              ]
            : [
                "text-white",
                "shadow-elevated",
                "hover:scale-105 active:scale-95",
              ]
        )}
        style={{
          background: isExpanded ? 'var(--paper-white)' : 'var(--accent)',
          border: isExpanded ? '1px solid var(--line-hi)' : 'none',
          color: isExpanded ? 'var(--ink-soft)' : undefined,
        }}
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
        <div className="fixed bottom-6 right-6 z-[9999] w-[300px] rounded-2xl flex flex-col items-center justify-center gap-2 p-6" style={{ background: 'var(--paper-white)', border: '1px solid var(--rose)', boxShadow: 'var(--shadow-elevated)' }}>
          <AlertTriangle className="w-8 h-8 mb-1" style={{ color: 'var(--rose)' }} />
          <div className="text-sm font-semibold text-center font-heading" style={{ color: 'var(--ink)' }}>AI Chat gặp lỗi</div>
          <div className="text-xs text-center mb-2" style={{ color: 'var(--muted)' }}>Đã có lỗi xảy ra trong quá trình hiển thị.</div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="btn-ghost"
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
    <AIChatWidgetInner />
  </AIChatErrorBoundary>
);

// ─── Embedded full-page panel (used by /ai route as navigation tab) ─────────
// Khác với floating widget: luôn expanded, không FAB, chiếm toàn bộ main area.

const AIChatPanelInner: React.FC = () => {
  const {
    widgetState,
    messages,
    inputValue,
    dslPreview,
    sessionId,
    sessions,
    historyLoading,
    setInputValue,
    openWidget,
    sendCommand,
    openMattermostApproval,
    cancelApproval,
    loadSessions,
    switchSession,
    newChat,
  } = useAICommand();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  // Nạp danh sách sessions 1 lần khi vào trang /ai.
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Tab luôn mở — auto expand khi mount
  useEffect(() => {
    if (widgetState === "collapsed") {
      openWidget();
    }
  }, [widgetState, openWidget]);

  // Auto-scroll khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, widgetState]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCommand();
    }
  };

  const isInputDisabled = widgetState === "thinking" || widgetState === "awaiting_approval";
  const canSend = inputValue.trim().length > 0 && !isInputDisabled;

  return (
    <div
      id="ai-chat-page-root"
      className="h-full flex flex-row"
      role="complementary"
      aria-label="Proteus AI Chat"
    >
      {/* Sidebar lịch sử */}
      {showSidebar && (
        <div
          className="w-60 shrink-0 h-full hidden md:flex flex-col"
          style={{ borderRight: "1px solid var(--line)", background: "var(--paper-raised)" }}
        >
          <HistoryList
            sessions={sessions}
            activeId={sessionId}
            loading={historyLoading && sessions.length === 0}
            onSwitch={switchSession}
            onNew={newChat}
          />
        </div>
      )}
      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Toggle sidebar */}
      <div className="hidden md:flex items-center gap-1 px-4 pt-2 shrink-0">
        <button
          onClick={() => {
            if (!showSidebar) loadSessions();
            setShowSidebar((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-text-disabled hover:text-text-primary transition-colors"
          title={showSidebar ? "Ẩn lịch sử" : "Hiện lịch sử"}
        >
          <History className="w-3.5 h-3.5" />
          {showSidebar ? "Ẩn lịch sử" : "Lịch sử"}
        </button>
        <button
          onClick={newChat}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-text-disabled hover:text-text-primary transition-colors"
          title="Bắt đầu đoạn chat mới"
        >
          <Plus className="w-3.5 h-3.5" />
          Chat mới
        </button>
      </div>
      {/* Messages Area */}
      <div
        id="ai-chat-messages"
        role="log"
        aria-live="polite"
        aria-atomic="false"
        aria-label="Lịch sử hội thoại với Proteus AI"
        className="flex-1 overflow-y-auto px-4 md:px-6 py-4"
      >
        <div className="max-w-3xl mx-auto w-full">
          {historyLoading && messages.length <= 1 && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-text-disabled">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Đang tải lịch sử…
            </div>
          )}
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

      {/* Input Area — sticky bottom */}
      <div
        className="shrink-0 px-4 md:px-6 pb-4 pt-2"
        style={{ background: "var(--paper)" }}
      >
        <div
          className="max-w-3xl mx-auto flex items-end gap-2 rounded-2xl px-3 py-2"
          style={{ background: "var(--paper-white)", border: "1px solid var(--line-hi)" }}
        >
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
              "resize-none outline-none leading-5 py-2 max-h-[120px] overflow-y-auto",
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
              canSend ? "text-white shadow-elevated" : "cursor-not-allowed"
            )}
            style={{
              background: canSend ? "var(--accent)" : "var(--paper)",
              color: canSend ? "white" : "var(--dim)",
            }}
          >
            {widgetState === "thinking" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="max-w-3xl mx-auto text-center text-[11px] mt-2 font-mono" style={{ color: "var(--dim)" }}>
          Proteus AI có thể tra cứu dữ liệu &amp; thực hiện tác vụ cần phê duyệt qua Mattermost
        </p>
      </div>
      </div>{/* /main column */}
    </div>
  );
};

export const AIChatPanel: React.FC = () => (
  <AIChatErrorBoundary>
    <AIChatPanelInner />
  </AIChatErrorBoundary>
);

