// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// useAICommand — Custom Hook quản lý AI Chat Widget state & logic
// Tách biệt hoàn toàn Business Logic khỏi UI (AGENTS.md §2, §8)
// Giao tiếp qua BFF /api/ai/command (không gọi FastAPI trực tiếp)
// Tham chiếu: docs/architecture.md §2.1 (BFF Pattern), docs/dsl-spec.md

import { useState, useCallback, useRef, useEffect } from "react";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";

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
}

export interface DslPreview {
  command_id: string;
  action: string;
  effect: "read" | "write" | "critical";
  approval_message: string;
  dry_run_result?: {
    affected_count: number;
    preview: Array<Record<string, unknown>>;
  };
  approval_deadline: string;
}

  interface AICommandBFFResponse {
    /** effect=read: trả kết quả trực tiếp */
    result?: any;
    /** effect=write/critical: kết quả dry run */
    dry_run_result?: DslPreview;
    /** Trạng thái xử lý */
    status: "COMPLETED" | "PENDING_APPROVAL" | "FAILED" | "TIMEOUT" | "EXECUTING" | "error" | "completed" | "pending_approval";
    message: string;
  }
  
  interface UseAICommandReturn {
    widgetState: WidgetState;
    messages: ChatMessage[];
    inputValue: string;
    dslPreview: DslPreview | null;
    sessionId: string;
    setInputValue: (value: string) => void;
    openWidget: () => void;
    minimizeWidget: () => void;
    resetAndClose: () => void;
    clearHistory: () => void;
    sendCommand: () => Promise<void>;
    openMattermostApproval: () => void;
    cancelApproval: () => void;
  }
  
  // ─── Hook Implementation ───────────────────────────────────────────────────────
  
  export function useAICommand(): UseAICommandReturn {
    const userId = useAuthStore((s) => s.user?.id ?? null);
    const [widgetState, setWidgetState] = useState<WidgetState>("collapsed");
    const [messages, setMessages] = useState<ChatMessage[]>([
      {
        id: uuid(),
        role: "assistant",
        content: "Xin chào! Tôi là Proteus AI. Tôi có thể giúp bạn truy vấn dữ liệu hoặc thực hiện các tác vụ quản trị. Hãy nhập lệnh bằng tiếng Việt tự nhiên.",
        timestamp: new Date(),
      },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [dslPreview, setDslPreview] = useState<DslPreview | null>(null);
    const [sessionId, setSessionId] = useState<string>(() => uuid());
  
    const { addToast } = useNotificationStore();

    // Key per-user: user sau trên cùng máy không đọc được chat user trước.
    const histKey = userId ? `proteus_ai_chat_history:${userId}` : null;
    const sessKey = userId ? `proteus_ai_session_id:${userId}` : null;

    const freshGreeting = (): ChatMessage[] => [
      {
        id: uuid(),
        role: "assistant",
        content:
          "Xin chào! Tôi là Proteus AI. Tôi có thể giúp bạn truy vấn dữ liệu hoặc thực hiện các tác vụ quản trị. Hãy nhập lệnh bằng tiếng Việt tự nhiên.",
        timestamp: new Date(),
      },
    ];

    // ─── Lịch sử Chat (server là source of truth, localStorage là cache) ────
    // Đọc history server sau khi login; rớt mạng mới dùng cache per-user.
    useEffect(() => {
      if (!histKey || !sessKey) return;
      let cancelled = false;
      (async () => {
        try {
          const localSession = localStorage.getItem(sessKey);
          const ensureRes = await fetch("/api/proxy/v1/ai/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: localSession || undefined }),
          });
          if (!ensureRes.ok) return;
          const { session_id } = await ensureRes.json();
          if (!session_id || cancelled) return;
          setSessionId(session_id);
          const msgRes = await fetch(
            `/api/proxy/v1/ai/sessions/${session_id}/messages?limit=100`
          );
          if (!msgRes.ok) return;
          const items = await msgRes.json();
          if (cancelled || !Array.isArray(items) || items.length === 0) return;
          const clean = items.filter(
            (m: any) => m && typeof m.content === "string" && m.content.length > 0
          );
          if (cancelled || clean.length === 0) return;
          setMessages(
            clean.map((m: any) => ({
              id: typeof m.id === "string" ? m.id : uuid(),
              role: m.role === "user" || m.role === "system" ? m.role : "assistant",
              content: m.content,
              timestamp: m.created_at ? new Date(m.created_at) : new Date(),
            }))
          );
        } catch {
          // Rớt mạng: giữ cache localStorage đã load ở effect trước.
        }
      })();
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [histKey]);

    // Dọn key chung legacy 1 lần (nguồn rò rỉ) — không migrate vì không biết của ai.
    useEffect(() => {
      try {
        localStorage.removeItem("proteus_ai_chat_history");
        localStorage.removeItem("proteus_ai_session_id");
      } catch {
        // Bỏ qua.
      }
    }, []);

    useEffect(() => {
      if (!histKey || !sessKey) {
        // Chưa login / vừa logout: reset RAM ngay, không đọc gì.
        setMessages(freshGreeting());
        setSessionId(uuid());
        setDslPreview(null);
        return;
      }
      try {
        const savedMessages = localStorage.getItem(histKey);
        const savedSession = localStorage.getItem(sessKey);
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(
              parsed.map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestamp),
              }))
            );
          } else {
            setMessages(freshGreeting());
          }
        } else {
          setMessages(freshGreeting());
        }
        setSessionId(savedSession || uuid());
        setDslPreview(null);
      } catch (e) {
        /* eslint-disable-next-line no-console */
        console.error("Failed to load AI chat history", e);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [histKey, sessKey]);

    useEffect(() => {
      if (!histKey || !sessKey) return;
      try {
        localStorage.setItem(histKey, JSON.stringify(messages));
        localStorage.setItem(sessKey, sessionId);
      } catch (e) {
        /* eslint-disable-next-line no-console */
        console.error("Failed to save AI chat history", e);
      }
    }, [messages, sessionId, histKey, sessKey]);
  
    // ─── Actions ─────────────────────────────────────────────────────────────────
  
    const openWidget = useCallback(() => {
      setWidgetState("expanded");
    }, []);
  
    const minimizeWidget = useCallback(() => {
      setWidgetState("collapsed");
    }, []);

    const clearHistory = useCallback(() => {
      try {
        if (histKey) localStorage.removeItem(histKey);
        if (sessKey) localStorage.removeItem(sessKey);
      } catch {
        // Bỏ qua.
      }
      setMessages([
        {
          id: uuid(),
          role: "assistant",
          content: "Xin chào! Tôi là Proteus AI. Tôi có thể giúp bạn truy vấn dữ liệu hoặc thực hiện các tác vụ quản trị. Hãy nhập lệnh bằng tiếng Việt tự nhiên.",
          timestamp: new Date(),
        },
      ]);
      setSessionId(uuid());
      setDslPreview(null);
    }, [histKey, sessKey]);
  
    const resetAndClose = useCallback(() => {
      setWidgetState("collapsed");
      setDslPreview(null);
      // Không clear lịch sử chat khi đóng Widget nữa
    }, []);
  
    const appendMessage = useCallback((role: MessageRole, content: string) => {
      setMessages((prev) => [
        ...prev,
        { id: uuid(), role, content, timestamp: new Date() },
      ]);
    }, []);
  
    /** Render kết quả read: stringify + dòng trích dẫn RAG nếu có. */
    const formatResult = useCallback((result: any): string => {
      if (typeof result === "string") return result;
      // Reply trò chuyện: hiện thẳng nội dung, không dump JSON.
      if (
        typeof result === "object" &&
        result !== null &&
        typeof result.reply === "string" &&
        Object.keys(result).length === 1
      ) {
        return result.reply;
      }
      const cites = result?.citations;
      const body =
        typeof result === "object" && result !== null && "citations" in result
          ? { query: (result as any).query }
          : result;
      let text = JSON.stringify(body, null, 2);
      const MAX_LEN = 4000;
      if (text.length > MAX_LEN) {
        text =
          text.slice(0, MAX_LEN) +
          `\n… (đã rút gọn, còn ${text.length - MAX_LEN} ký tự)`;
      }
      if (Array.isArray(cites) && cites.length > 0) {
        const lines = cites.map((c: any, i: number) => {
          const title = c?.doc_title || c?.source_url || `Tài liệu ${i + 1}`;
          const score = typeof c?.score === "number" ? ` (${c.score.toFixed(2)})` : "";
          return `${i + 1}. ${title}${score}`;
        });
        text += `\n\n📚 Nguồn tham khảo:\n${lines.join("\n")}`;
      }
      return text;
    }, []);

    /** Áp dụng response (chuẩn BFF hoặc event result SSE) vào UI. */
    const applyResult = useCallback(
      (data: AICommandBFFResponse) => {
        // Xử lý status phân biệt hoa/thường để match Enum từ Python
        const statusUpper =
          typeof data.status === "string" ? data.status.toUpperCase() : "ERROR";

        if (statusUpper === "COMPLETED") {
          // Backend trả summary ở message + data thật trong result.steps[].result.
          // Hiện summary trước, data chi tiết sau (không dump JSON trạng thái).
          const steps = (data.result as any)?.steps;
          // Reply trò chuyện thuần túy: message đã là nội dung sạch từ server.
          if (
            Array.isArray(steps) &&
            steps.length === 1 &&
            steps[0].action === "core.chat.reply" &&
            typeof steps[0].result === "string"
          ) {
            appendMessage("assistant", data.message || steps[0].result);
            setWidgetState("expanded");
            return;
          }
          if (
            Array.isArray(steps) &&
            steps.length === 1 &&
            steps[0].action === "core.chat.reply" &&
            typeof steps[0].result?.reply === "string"
          ) {
            appendMessage("assistant", steps[0].result.reply);
            setWidgetState("expanded");
            return;
          }
          const details: string[] = [];
          if (Array.isArray(steps)) {
            for (const s of steps) {
              if (
                s &&
                s.status === "COMPLETED" &&
                s.result !== null &&
                s.result !== undefined
              ) {
                details.push(formatResult(s.result));
              }
            }
          } else if (data.result) {
            details.push(formatResult(data.result));
          }
          const content =
            details.length > 0
              ? `${data.message}\n\n📦 Kết quả:\n${details.join("\n\n")}`
              : data.message || "Hoàn thành.";
          appendMessage("assistant", content);
          setWidgetState("expanded");
        } else if (statusUpper === "PENDING_APPROVAL") {
          const preview = data.dry_run_result || (data as any).dsl_preview || data.result || {
            action: "System Command",
            effect: "write",
          };
          setDslPreview(preview);
          appendMessage(
            "assistant",
            `🔒 Lệnh này yêu cầu phê duyệt từ Ban Giám đốc.\n\n**Hành động:** \`${preview.action || "Execute"}\`\n\nVui lòng bấm **"Phê duyệt trên Mattermost"** để tiếp tục.`
          );
          setWidgetState("awaiting_approval");
        } else {
          appendMessage("assistant", data.message || "Đã xảy ra lỗi không xác định.");
          setWidgetState("expanded");
        }
      },
      [appendMessage, formatResult]
    );

    /**
     * sendViaStream — Gửi lệnh qua SSE /api/ai/chat/stream.
     * Trả về true nếu stream hoàn tất (kể cả FAILED nghiệp vụ),
     * false nếu lỗi kỹ thuật để caller fallback sang POST thường.
     */
    const sendViaStream = useCallback(
      async (trimmed: string): Promise<boolean> => {
        let response: Response;
        try {
          response = await fetch("/api/ai/chat/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              natural_language_input: trimmed,
              session_id: sessionId,
            }),
          });
        } catch {
          return false;
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !response.body || !contentType.includes("text/event-stream")) {
          return false;
        }
        try {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let currentEvent = "message";
          let done = false;
          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
            let idx;
            while ((idx = buffer.indexOf("\n\n")) !== -1) {
              const raw = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 2);
              let dataStr = "";
              for (const line of raw.split("\n")) {
                if (line.startsWith("event:")) currentEvent = line.slice(6).trim();
                else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
              }
              if (currentEvent === "result" && dataStr) {
                const payload = JSON.parse(dataStr);
                applyResult({
                  status: payload.status,
                  message: payload.message,
                  result: payload.result,
                  dry_run_result: payload.dry_run_result,
                } as AICommandBFFResponse);
                currentEvent = "message";
              }
              // event started/token/dsl: chỉ giữ kết nối sống, UI vẫn "thinking".
            }
          }
          return true;
        } catch {
          return false;
        }
      },
      [sessionId, applyResult]
    );

    /**
     * sendCommand — Ưu tiên SSE stream, fallback POST /api/ai/command.
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

      if (await sendViaStream(trimmed)) return;

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
          if (response.status === 401) {
              throw new Error("UNAUTHORIZED");
          }
          throw new Error(`API Error: ${response.status}`);
        } else {
          data = await response.json();
        }

        applyResult(data);
      } catch (error) {
        if (process.env.NEXT_PUBLIC_ENABLE_MOCKS === "true") {
          // Dev fallback
          const { MOCK_RESPONSES, detectEffectFromInput } = await import("../__tests__/useAICommand.mock");
          const detectedEffect = detectEffectFromInput(trimmed);
          const mockData = MOCK_RESPONSES[detectedEffect] as AICommandBFFResponse;
          const mockUpper = typeof mockData.status === "string" ? mockData.status.toUpperCase() : "ERROR";
  
          if (mockUpper === "PENDING_APPROVAL" && (mockData as any).dsl_preview) {
            setDslPreview({ ...(mockData as any).dsl_preview, command_id: uuid() });
            appendMessage(
              "assistant",
              `🔒 Lệnh này yêu cầu phê duyệt từ Ban Giám đốc.\n\n**Hành động:** \`${(mockData as any).dsl_preview.action}\`\n\nVui lòng bấm **"Phê duyệt trên Mattermost"** để tiếp tục.`
            );
            setWidgetState("awaiting_approval");
          } else if (mockUpper === "COMPLETED" && mockData.result) {
            const resultText = typeof mockData.result === "string" ? mockData.result : JSON.stringify(mockData.result, null, 2);
            appendMessage("assistant", resultText);
            setWidgetState("expanded");
          }
        } else {
          if (error instanceof Error && error.message === "UNAUTHORIZED") {
            appendMessage("assistant", "⚠️ Phiên làm việc của bạn đã hết hạn. Vui lòng tải lại trang (F5) và đăng nhập lại để tiếp tục sử dụng Proteus AI.");
            addToast("warning", "Phiên làm việc hết hạn");
          } else {
            appendMessage("assistant", "❌ Không thể kết nối tới AI Service. Vui lòng thử lại sau.");
            addToast("error", "Lỗi kết nối AI Service");
          }
          setWidgetState("expanded");
        }
      }
    }, [inputValue, widgetState, appendMessage, addToast, sessionId, applyResult, sendViaStream]);

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
   * cancelApproval — Huỷ lệnh đang chờ phê duyệt.
   */
  const cancelApproval = useCallback(() => {
    setDslPreview(null);
    appendMessage("assistant", "🚫 Lệnh đã được huỷ bỏ.");
    setWidgetState("expanded");
  }, [appendMessage]);

  return {
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
  };
}
