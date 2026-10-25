// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// useAICommand — Custom Hook quản lý AI Chat Widget state & logic
// Tách biệt hoàn toàn Business Logic khỏi UI (AGENTS.md §2, §8)
// Giao tiếp qua BFF /api/ai/command (không gọi FastAPI trực tiếp)
// Tham chiếu: docs/architecture.md §2.1 (BFF Pattern), docs/dsl-spec.md

import { useState, useCallback, useEffect, useRef } from "react";
import { useNotificationStore } from "@/store/notificationStore";
import api from "@/lib/api";

// Helper: dùng fallback khi chạy trên HTTP không có crypto.randomUUID
const uuid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type WidgetState = "collapsed" | "expanded" | "thinking" | "awaiting_approval";

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  /** Chi tiết steps/thoughts — UI ẩn sau click, chỉ có ở tin assistant. */
  details?: {
    steps: Array<{ action: string; status: string; message: string }>;
    thoughts: string[];
  } | null;
}

export interface DslPreview {
  command_id: string;
  action: string;
  effect: "read" | "write" | "critical";
  approval_message: string;
  dry_run_result?: {
    affected_count: number;
    preview: Array<Record<string, unknown>>;
    message?: string;
    /** true = không đếm được phạm vi (workflow tự quyết bảng) — khác với 0 thật. */
    unknown_scope?: boolean;
  };
  approval_deadline: string;
}

const APPROVAL_NEED =
  (effect: string) =>
    effect === "critical" ? "cần 2 người duyệt" : "cần 1 người duyệt";

function terminalMessage(status: string): string | null {
  switch (status) {
    case "APPROVED":
      return "✅ Lệnh đã được phê duyệt và đang thực hiện.";
    case "COMPLETED":
      return "✅ Lệnh đã được phê duyệt và thực hiện xong.";
    case "EXECUTING":
      return "⚙️ Lệnh đã được duyệt, đang thực hiện…";
    case "REJECTED":
      return "❌ Lệnh đã bị từ chối.";
    case "TIMEOUT":
      return "⏰ Lệnh đã hết hạn chờ phê duyệt.";
    case "FAILED":
      return "❌ Lệnh gặp lỗi khi thực hiện sau phê duyệt.";
    default:
      return null;
  }
}

interface AICommandBFFResponse {
  /** effect=read: trả kết quả trực tiếp */
  result?: string;
  /** effect=write/critical: DSL preview để hiển thị awaiting_approval */
  dsl_preview?: DslPreview;
  /** Chi tiết steps/thoughts (backend tách khỏi message chính) */
  details?: ChatMessage["details"];
  /** Trạng thái xử lý */
  status: "completed" | "pending_approval" | "error";
  message: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  updated_at: string | null;
}

interface UseAICommandReturn {
  widgetState: WidgetState;
  messages: ChatMessage[];
  inputValue: string;
  dslPreview: DslPreview | null;
  sessionId: string;
  sessions: ChatSession[];
  historyLoading: boolean;
  setInputValue: (value: string) => void;
  openWidget: () => void;
  minimizeWidget: () => void;
  resetAndClose: () => void;
  sendCommand: () => Promise<void>;
  openMattermostApproval: () => void;
  cancelApproval: () => Promise<void>;
  loadSessions: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  newChat: () => void;
}

// Key lưu session đang dùng — reload trang vẫn tiếp tục đoạn chat cũ
// (lịch sử thật nằm server-side ở ai_sessions/ai_messages).
const SESSION_STORAGE_KEY = "proteus-ai-session-id";

const GREETING =
  "Xin chào! Tôi là Proteus AI. Tôi có thể giúp bạn truy vấn dữ liệu hoặc thực hiện các tác vụ quản trị. Hãy nhập lệnh bằng tiếng Việt tự nhiên.";

// ─── Hook Implementation ───────────────────────────────────────────────────────

export function useAICommand(): UseAICommandReturn {
  const [widgetState, setWidgetState] = useState<WidgetState>("collapsed");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uuid(),
      role: "assistant",
      content: GREETING,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [dslPreview, setDslPreview] = useState<DslPreview | null>(null);
  // Giữ session qua reload — lịch sử server-side load theo session này.
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved && /^[0-9a-f-]{8,}$/i.test(saved)) return saved;
    } catch {
      // localStorage bị chặn thì dùng session mới mỗi lần.
    }
    const fresh = uuid();
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, fresh);
    } catch {
      // Bỏ qua.
    }
    return fresh;
  });
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // Chặn load trùng khi 2 instance hook cùng mount (widget + panel).
  const loadedForRef = useRef<string | null>(null);

  const { addToast } = useNotificationStore();

  const persistSession = useCallback((id: string) => {
    setSessionId(id);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, id);
    } catch {
      // Bỏ qua.
    }
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const openWidget = useCallback(() => {
    setWidgetState("expanded");
  }, []);

  const minimizeWidget = useCallback(() => {
    setWidgetState("collapsed");
  }, []);

  const resetAndClose = useCallback(() => {
    setWidgetState("collapsed");
    setDslPreview(null);
    setMessages([
      {
        id: uuid(),
        role: "assistant",
        content: GREETING,
        timestamp: new Date(),
      },
    ]);
    persistSession(uuid());
  }, [persistSession]);

  // ─── Lịch sử server-side (ai_sessions/ai_messages) ──────────────────────

  const loadMessages = useCallback(async (sid: string) => {
    setHistoryLoading(true);
    try {
      // Ensure trước để session chắc chắn tồn tại (giữ ID client yêu cầu).
      await api.post("/v1/ai/sessions", { session_id: sid }).catch(() => null);
      const res = await api.get(`/v1/ai/sessions/${sid}/messages`);
      const rows = Array.isArray(res.data) ? res.data : [];
      if (rows.length > 0) {
        setMessages(
          rows
            .filter(
              (m: any) =>
                m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
            )
            .map((m: any) => ({
              id: String(m.id || uuid()),
              role: m.role as MessageRole,
              content: m.content,
              timestamp: m.created_at ? new Date(m.created_at) : new Date(),
              details: null,
            }))
        );
      }
    } catch {
      // Best-effort: offline/chưa login thì giữ lời chào, không chặn chat.
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load lịch sử 1 lần cho session hiện tại khi mount.
  useEffect(() => {
    if (loadedForRef.current === sessionId) return;
    loadedForRef.current = sessionId;
    loadMessages(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await api.get("/v1/ai/sessions");
      const rows = Array.isArray(res.data) ? res.data : [];
      setSessions(
        rows
          .filter((s: any) => s && typeof s.id === "string")
          .map((s: any) => ({
            id: s.id,
            title: typeof s.title === "string" ? s.title : null,
            updated_at: typeof s.updated_at === "string" ? s.updated_at : null,
          }))
      );
    } catch {
      // Best-effort — panel lịch sử trống chứ không lỗi.
    }
  }, []);

  const switchSession = useCallback(
    async (id: string) => {
      if (!id || id === sessionId || widgetState === "thinking") return;
      persistSession(id);
      loadedForRef.current = id;
      setDslPreview(null);
      await loadMessages(id);
    },
    [sessionId, widgetState, persistSession, loadMessages]
  );

  const newChat = useCallback(() => {
    if (widgetState === "thinking") return;
    const fresh = uuid();
    persistSession(fresh);
    loadedForRef.current = fresh;
    setDslPreview(null);
    setMessages([
      {
        id: uuid(),
        role: "assistant",
        content: GREETING,
        timestamp: new Date(),
      },
    ]);
    // Ensure luôn để lần gửi đầu không phải chờ tạo session.
    api.post("/v1/ai/sessions", { session_id: fresh }).catch(() => null);
    loadSessions();
  }, [widgetState, persistSession, loadSessions]);

  const appendMessage = useCallback((role: MessageRole, content: string, details?: ChatMessage["details"]) => {
    setMessages((prev) => [
      ...prev,
      { id: uuid(), role, content, timestamp: new Date(), details: details ?? null },
    ]);
  }, []);

  /**
   * sendCommand — Gửi lệnh tới BFF /api/ai/command
   * BFF sẽ inject JWT Token từ HttpOnly Cookie và forward tới FastAPI.
   * effect=read → hiển thị kết quả ngay.
   * effect=write/critical → chuyển sang state awaiting_approval + hiện DSL preview.
   */
  const sendCommand = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || widgetState === "thinking") return;

    // Thêm tin nhắn người dùng
    appendMessage("user", trimmed);
    setInputValue("");
    setWidgetState("thinking");

    try {
      const response = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          natural_language_input: trimmed,
          session_id: sessionId,
        }),
      });

      let data: AICommandBFFResponse;

      if (!response.ok && process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true") {
        // Dev fallback: mock response khi API chưa có
        const { MOCK_RESPONSES, detectEffectFromInput } = await import("../__tests__/useAICommand.mock");
        const detectedEffect = detectEffectFromInput(trimmed);
        data = MOCK_RESPONSES[detectedEffect] as AICommandBFFResponse;
      } else if (!response.ok) {
        // Đọc message thật từ BFF (VD: timeout 504) để user biết đường chờ,
        // thay vì lúc nào cũng báo "không kết nối" chung chung.
        let serverMessage = "";
        try {
          const errBody = await response.json();
          if (typeof errBody?.message === "string" && errBody.message.trim()) {
            serverMessage = errBody.message.trim();
          }
        } catch {
          /* body không phải JSON — dùng message mặc định bên dưới */
        }
        throw new Error(serverMessage || `API Error: ${response.status}`);
      } else {
        data = await response.json();
      }

      if (data.status === "completed" && data.result) {
        // effect=read: hiển thị output chính + details ẩn sau click
        appendMessage("assistant", data.result, data.details);
        setWidgetState("expanded");
      } else if (data.status === "pending_approval" && data.dsl_preview) {
        // effect=write/critical: chờ phê duyệt (chi tiết nằm ở card bên dưới).
        setDslPreview(data.dsl_preview);
        appendMessage(
          "assistant",
          `🔒 Đã tạo yêu cầu phê duyệt (${APPROVAL_NEED(data.dsl_preview.effect)}). ` +
            `Chi tiết bên dưới — duyệt trên Mattermost, trạng thái sẽ tự cập nhật tại đây.`,
          data.details
        );
        setWidgetState("awaiting_approval");
      } else {
        appendMessage("assistant", data.message || "Đã xảy ra lỗi không xác định.", data.details);
        setWidgetState("expanded");
      }
    } catch (error) {
      if (process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true") {
        // Dev fallback
        const { MOCK_RESPONSES, detectEffectFromInput } = await import("../__tests__/useAICommand.mock");
        const detectedEffect = detectEffectFromInput(trimmed);
        const mockData = MOCK_RESPONSES[detectedEffect] as AICommandBFFResponse;
        if (mockData.status === "pending_approval" && mockData.dsl_preview) {
          setDslPreview({ ...mockData.dsl_preview, command_id: uuid() });
          appendMessage(
            "assistant",
            `🔒 Lệnh này yêu cầu phê duyệt từ Ban Giám đốc.\n\n**Hành động:** \`${mockData.dsl_preview.action}\`\n\nVui lòng bấm **"Phê duyệt trên Mattermost"** để tiếp tục.`
          );
          setWidgetState("awaiting_approval");
        } else if (mockData.status === "completed" && mockData.result) {
          appendMessage("assistant", mockData.result);
          setWidgetState("expanded");
        }
      } else {
        const msg = error instanceof Error ? error.message : "";
        if (msg && !msg.startsWith("API Error")) {
          appendMessage("assistant", `⚠️ ${msg} Vui lòng thử lại sau.`);
          addToast("error", msg);
        } else {
          appendMessage("assistant", "❌ Không thể kết nối tới AI Service. Vui lòng thử lại sau.");
          addToast("error", "Lỗi kết nối AI Service");
        }
        setWidgetState("expanded");
      }
    }
  }, [inputValue, widgetState, appendMessage, addToast, sessionId]);

  /**
   * openMattermostApproval — Mở Mattermost để phê duyệt.
   * Widget ở trạng thái awaiting_approval, người dùng bấm nút này để
   * chuyển sang Mattermost bấm [Phê duyệt].
   * Rule sinh tử: AI KHÔNG tự bypass bước này (AGENTS.md §4).
   */
  const openMattermostApproval = useCallback(() => {
    // Mở Mattermost — trong production, URL này từ env config
    const mattermostUrl = process.env.NEXT_PUBLIC_MATTERMOST_URL || "/chat";
    window.open(mattermostUrl, "_blank", "noopener,noreferrer");
    addToast(
      "info",
      "Đã mở Mattermost. Vui lòng bấm [Phê duyệt] trên tin nhắn từ Proteus AI."
    );
  }, [addToast]);

  /**
   * cancelApproval — Hủy thật lệnh đang chờ duyệt qua API (trước đây chỉ
   * xóa card local nên lệnh vẫn treo PENDING trên server).
   */
  const cancelApproval = useCallback(async () => {
    const cmdId = dslPreview?.command_id;
    setDslPreview(null);
    setWidgetState("expanded");
    if (!cmdId) {
      appendMessage("assistant", "🚫 Lệnh đã được huỷ bỏ.");
      return;
    }
    try {
      const res = await api.post(`/v1/ai/commands/${cmdId}/cancel`);
      appendMessage(
        "assistant",
        res.data?.cancelled
          ? "🚫 Bạn đã hủy lệnh chờ duyệt."
          : `🚫 Không hủy được: ${res.data?.reason || "lệnh đã được xử lý."}`
      );
    } catch {
      appendMessage(
        "assistant",
        "🚫 Đã đóng yêu cầu trên chat. Nếu lệnh vẫn chờ duyệt, hãy hủy trên web."
      );
    }
  }, [dslPreview, appendMessage]);

  // Poll trạng thái lệnh khi đang chờ duyệt — có người duyệt/từ chối trên
  // Mattermost thì chat tự cập nhật, không cần F5. Dừng khi hết chờ/khi
  // chuyển đoạn chat (dslPreview đổi theo effect bên dưới).
  useEffect(() => {
    if (!dslPreview) return;
    const cmdId = dslPreview.command_id;
    let stopped = false;
    let polls = 0;
    const timer = setInterval(async () => {
      polls += 1;
      if (polls > 180 || stopped) {
        clearInterval(timer);
        return;
      }
      try {
        const res = await api.get(`/v1/ai/commands/${cmdId}/status`);
        const text = terminalMessage(String(res.data?.status || ""));
        if (!text) return; // vẫn PENDING → poll tiếp
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        setDslPreview((cur) => (cur?.command_id === cmdId ? null : cur));
        appendMessage("assistant", text);
        setWidgetState("expanded");
      } catch (err: any) {
        if (err?.response?.status === 404) {
          clearInterval(timer); // lệnh không còn → dừng poll
        }
      }
    }, 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [dslPreview, appendMessage]);

  return {
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
  };
}
