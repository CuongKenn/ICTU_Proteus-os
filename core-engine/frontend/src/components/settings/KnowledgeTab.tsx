// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  BookOpen,
  Search,
  RefreshCw,
  Database,
  FilePlus2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  Upload,
  FileText,
} from "lucide-react";
import { useSession } from "next-auth/react";

import api from "@/lib/api";
import { logger } from "@/lib/logger";

type SubTab = "search" | "sync" | "ingest" | "create";

interface Citation {
  document?: string;
  score?: number;
  doc_title?: string;
  source_url?: string;
}

interface SyncedDoc {
  external_id?: string;
  filename?: string;
  title?: string;
  url?: string;
  chars?: number;
  error?: string;
}

interface Notice {
  kind: "success" | "error" | "info";
  text: string;
}

const inputCls =
  "w-full bg-bg-surface border border-border rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-primary transition-colors";
const labelCls = "text-sm font-medium text-text-primary";
const hintCls = "text-xs text-text-secondary leading-relaxed";

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: "search", label: "Tìm kiếm", icon: Search },
  { id: "sync", label: "Đồng bộ web", icon: RefreshCw },
  { id: "ingest", label: "Nạp cho AI", icon: Database },
  { id: "create", label: "Viết tài liệu", icon: FilePlus2 },
];

const EXAMPLE_QUERIES = [
  "Quy định nghỉ phép 2026 thế nào?",
  "Hạn mức duyệt chi bao nhiêu?",
  "Proteus OS là gì?",
];

const FEED_EXAMPLE = `{
  "documents": [
    { "title": "Nội quy công ty", "text": "Điều 1: ..." },
    { "title": "Quy trình A", "text": "Bước 1: ..." }
  ]
}`;

function NoticeBox({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const style =
    notice.kind === "success"
      ? "bg-success/10 text-success border-success/20"
      : notice.kind === "error"
        ? "bg-error/10 text-error border-error/20"
        : "bg-primary/10 text-primary border-primary/20";
  const Icon =
    notice.kind === "success"
      ? CheckCircle2
      : notice.kind === "error"
        ? XCircle
        : Clock;
  return (
    <div className={`p-3.5 rounded-lg border text-sm flex gap-2.5 ${style}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="whitespace-pre-line">{notice.text}</span>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 min-w-[110px] p-3 bg-bg-base/60 rounded-lg border border-border text-center">
      <div className="text-xl font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-secondary mt-0.5">{label}</div>
    </div>
  );
}

export const KnowledgeTab: React.FC = () => {
  const { data: session } = useSession();
  const [sub, setSub] = useState<SubTab>("search");

  // Search
  const [query, setQuery] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchNotice, setSearchNotice] = useState<Notice | null>(null);

  // Sync
  const [connectors, setConnectors] = useState<string[]>([]);
  const [feedUrl, setFeedUrl] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<{
    fetched: number;
    created: SyncedDoc[];
    skipped: number;
    failed: number;
  } | null>(null);
  const [syncNotice, setSyncNotice] = useState<Notice | null>(null);
  const [copied, setCopied] = useState(false);

  // File upload (PDF/DOCX/TXT/MD)
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<SyncedDoc[]>([]);
  const [uploadNotice, setUploadNotice] = useState<Notice | null>(null);

  // Ingest
  const [ingesting, setIngesting] = useState(false);
  const [ingestStats, setIngestStats] = useState<{
    docs: number;
    chunks: number;
  } | null>(null);
  const [ingestNotice, setIngestNotice] = useState<Notice | null>(null);

  // Create
  const [docTitle, setDocTitle] = useState("");
  const [docText, setDocText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!session) return;
    api
      .get("/v1/ai/knowledge/connectors")
      .then((res) => setConnectors(res.data?.connectors ?? ["http_feed"]))
      .catch((err) => logger.error("Failed to fetch connectors", err));
  }, [session]);

  const doSearch = async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text) return;
    setQuery(text);
    setSearching(true);
    setSearchNotice(null);
    try {
      const res = await api.post("/v1/ai/knowledge/search", {
        query: text,
        limit: 5,
      });
      setCitations(res.data?.citations ?? []);
      setSearched(true);
    } catch (err: any) {
      logger.error("Knowledge search failed", err);
      setSearchNotice({
        kind: "error",
        text: err?.response?.data?.detail ?? "Tìm kiếm thất bại, thử lại sau.",
      });
    } finally {
      setSearching(false);
    }
  };

  const doSync = async () => {
    if (!feedUrl.trim()) {
      setSyncNotice({ kind: "error", text: "Dán link nguồn dữ liệu trước nhé." });
      return;
    }
    setSyncing(true);
    setSyncNotice(null);
    setSyncStats(null);
    try {
      const res = await api.post("/v1/ai/knowledge/sync", {
        connector: connectors[0] ?? "http_feed",
        config: { url: feedUrl.trim() },
        collection_id: collectionId.trim() || null,
      });
      const d = res.data ?? {};
      setSyncStats({
        fetched: d.fetched ?? 0,
        created: d.created ?? [],
        skipped: d.skipped ?? 0,
        failed: d.failed ?? 0,
      });
      setSyncNotice({
        kind: (d.failed ?? 0) > 0 ? "info" : "success",
        text:
          (d.failed ?? 0) > 0
            ? `Đồng bộ xong nhưng có ${d.failed} tài liệu lỗi — kiểm tra lại nguồn.`
            : `Đồng bộ xong! Nhớ qua tab "Nạp cho AI" để AI đọc được tài liệu mới.`,
      });
    } catch (err: any) {
      logger.error("Knowledge sync failed", err);
      setSyncNotice({
        kind: "error",
        text:
          err?.response?.status === 403
            ? "Tài khoản của bạn chưa có quyền đồng bộ. Nhờ admin cấp quyền nhé."
            : (err?.response?.data?.detail ??
              "Không lấy được dữ liệu từ link này. Kiểm tra link có trả đúng định dạng JSON không."),
      });
    } finally {
      setSyncing(false);
    }
  };

  const doUpload = async () => {
    if (files.length === 0) {
      setUploadNotice({ kind: "error", text: "Chọn ít nhất 1 file đã nhé." });
      return;
    }
    setUploading(true);
    setUploadNotice(null);
    setUploaded([]);
    const results: SyncedDoc[] = [];
    for (const f of files) {
      const form = new FormData();
      form.append("file", f);
      if (collectionId.trim()) form.append("collection_id", collectionId.trim());
      try {
        const res = await fetch("/api/proxy/v1/ai/knowledge/upload", {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          results.push({
            filename: f.name,
            error:
              data?.detail ??
              (res.status === 403
                ? "Tài khoản chưa có quyền. Nhờ admin cấp quyền nhé."
                : "Tải lên thất bại."),
          });
        } else {
          results.push({
            filename: f.name,
            title: data?.title,
            url: data?.url,
            chars: data?.chars,
          });
        }
      } catch (err) {
        logger.error("Knowledge upload failed", err);
        results.push({ filename: f.name, error: "Lỗi mạng, thử lại sau." });
      }
    }
    setUploaded(results);
    const ok = results.filter((r) => !r.error).length;
    setUploadNotice(
      ok === results.length
        ? {
            kind: "success",
            text: `Đăng xong ${ok} tài liệu! Qua tab "Nạp cho AI" để AI đọc được.`,
          }
        : {
            kind: "info",
            text: `Đăng được ${ok}/${results.length} file — xem lỗi từng file bên dưới.`,
          }
    );
    setUploading(false);
  };

  const doIngest = async () => {
    setIngesting(true);
    setIngestNotice(null);
    setIngestStats(null);
    try {
      // Nạp embedding trên CPU mất 1-3 phút — chờ lâu hơn timeout mặc định 30s.
      const res = await api.post("/v1/ai/knowledge/ingest", {}, { timeout: 300_000 });
      const d = res.data ?? {};
      if (d.status === "failed") {
        setIngestNotice({
          kind: "error",
          text: `Nạp thất bại: ${d.error ?? "lỗi không rõ"}.`,
        });
      } else {
        setIngestStats({
          docs: d.processed_documents ?? 0,
          chunks: d.upserted_chunks ?? 0,
        });
        setIngestNotice({
          kind: "success",
          text: "Xong! Giờ bạn có thể tìm kiếm hoặc hỏi AI về tài liệu mới.",
        });
      }
    } catch (err: any) {
      logger.error("RAG ingest failed", err);
      if (err?.code === "ECONNABORTED") {
        setIngestNotice({
          kind: "info",
          text: "Nạp lâu quá nên trình duyệt ngừng chờ — nhưng hệ thống vẫn đang nạp ngầm. Đợi 1–2 phút rồi qua tab Tìm kiếm kiểm tra nhé.",
        });
      } else {
        setIngestNotice({
          kind: "error",
          text: err?.response?.data?.detail ?? "Nạp thất bại, thử lại sau.",
        });
      }
    } finally {
      setIngesting(false);
    }
  };

  const doCreate = async () => {
    if (!docTitle.trim() || !docText.trim()) {
      setSaveNotice({
        kind: "error",
        text: "Điền cả tiêu đề và nội dung nhé.",
      });
      return;
    }
    setSaving(true);
    setSaveNotice(null);
    try {
      const res = await api.post("/v1/ai/command", {
        dsl_version: "1.0",
        session_id: crypto.randomUUID(),
        action: "core.knowledge.save",
        effect: "write",
        parameters: { title: docTitle.trim(), text: docText.trim() },
        approval_message: `Lưu tài liệu "${docTitle.trim()}" vào Wiki. Xác nhận?`,
      });
      const st = res.data?.status;
      setSaveNotice({
        kind: st === "PENDING_APPROVAL" ? "info" : "success",
        text:
          st === "PENDING_APPROVAL"
            ? `Đã gửi yêu cầu!\nBước tiếp theo: mở Mattermost, bấm "Phê duyệt" thì tài liệu mới được đăng lên Wiki.`
            : (res.data?.message ?? "Đã lưu."),
      });
      if (st !== "FAILED") {
        setDocTitle("");
        setDocText("");
      }
    } catch (err: any) {
      logger.error("Save doc failed", err);
      setSaveNotice({
        kind: "error",
        text: err?.response?.data?.detail ?? "Gửi thất bại, thử lại sau.",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyExample = async () => {
    try {
      await navigator.clipboard.writeText(FEED_EXAMPLE);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard không khả dụng — bỏ qua */
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border pb-5">
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <BookOpen className="w-5 h-5" /> Tri thức nội bộ
        </h2>
        <p className="text-text-secondary text-sm mt-1">
          Nơi tra cứu và bổ sung tài liệu cho cả công ty — AI cũng học từ đây.
        </p>
      </div>

      {/* Sub-tab pills */}
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium transition-all border"
            style={
              sub === t.id
                ? {
                    background: "var(--accent)",
                    color: "#fff",
                    borderColor: "var(--accent)",
                  }
                : {
                    background: "transparent",
                    color: "var(--muted)",
                    borderColor: "var(--line-hi)",
                  }
            }
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SEARCH ── */}
      {sub === "search" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Hỏi gì đó... ví dụ: nghỉ phép cần duyệt mấy cấp?"
              className={inputCls}
            />
            <Button onClick={() => doSearch()} isLoading={searching} disabled={!query.trim()}>
              Tìm
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={hintCls}>Thử ngay:</span>
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => doSearch(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-border text-text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
          <NoticeBox notice={searchNotice} />
          {searched && citations.length === 0 && !searchNotice && (
            <div className="text-center py-10 text-text-secondary text-sm">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Không tìm thấy tài liệu nào phù hợp.
              <br />
              Thử từ khóa khác, hoặc qua tab &ldquo;Viết tài liệu&rdquo; để bổ sung.
            </div>
          )}
          {citations.length > 0 && (
            <ul className="space-y-3">
              {citations.map((c, i) => (
                <li
                  key={i}
                  className="p-4 bg-bg-surface/60 rounded-xl border border-border hover:border-primary/40 transition-colors"
                >
                  <div className="font-semibold text-text-primary text-sm">
                    {i + 1}. {c.doc_title || "Tài liệu không tên"}
                  </div>
                  {c.document && (
                    <p className="text-[13px] text-text-secondary mt-1.5 leading-relaxed">
                      {c.document.length > 220
                        ? `${c.document.slice(0, 220)}…`
                        : c.document}
                    </p>
                  )}
                  {c.source_url && (
                    <a
                      href={c.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] text-primary inline-flex items-center gap-1 mt-2 font-medium"
                    >
                      Đọc đầy đủ <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── SYNC ── */}
      {sub === "sync" && (
        <div className="space-y-4">
          {/* Upload file */}
          <div className="p-4 bg-bg-surface/60 border border-border rounded-xl space-y-3">
            <h4 className="font-medium text-text-primary text-sm flex items-center gap-2">
              <Upload className="w-4 h-4" /> Tải file từ máy lên
            </h4>
            <p className={hintCls}>
              Nhận PDF, Word (.docx), TXT, MD — mỗi file thành 1 bài trên Wiki
              (tối đa 10MB/file).
            </p>
            <label className="flex items-center justify-center gap-2 w-full px-4 py-6 rounded-lg border border-dashed border-border cursor-pointer hover:border-primary transition-colors text-sm text-text-secondary">
              <FileText className="w-5 h-5" />
              {files.length > 0
                ? `Đã chọn ${files.length} file`
                : "Bấm để chọn file..."}
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) =>
                  setFiles(e.target.files ? Array.from(e.target.files) : [])
                }
              />
            </label>
            {files.length > 0 && (
              <ul className="text-xs text-text-secondary space-y-1">
                {files.map((f) => (
                  <li key={`${f.name}-${f.size}`}>
                    • {f.name} ({(f.size / 1024).toFixed(0)} KB)
                  </li>
                ))}
              </ul>
            )}
            <Button
              onClick={doUpload}
              isLoading={uploading}
              disabled={files.length === 0}
            >
              Tải lên & đăng Wiki
            </Button>
            <NoticeBox notice={uploadNotice} />
            {uploaded.length > 0 && (
              <ul className="space-y-2">
                {uploaded.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 p-3 bg-bg-base/60 rounded-lg border border-border text-sm"
                  >
                    <span className="flex items-center gap-2 text-text-primary">
                      {d.error ? (
                        <XCircle className="w-4 h-4 text-error shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      )}
                      <span>
                        {d.error
                          ? `${d.filename}: ${d.error}`
                          : (d.title || d.filename)}
                      </span>
                    </span>
                    {d.url && (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex items-center gap-1 text-[13px] shrink-0"
                      >
                        Xem <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-text-muted">
            <div className="flex-1 h-px bg-border" />
            hoặc đồng bộ từ link
            <div className="flex-1 h-px bg-border" />
          </div>

          <p className={hintCls}>
            Có sẵn danh sách tài liệu ở website khác? Dán link vào đây, hệ thống sẽ tự
            tải về và đăng lên Wiki.
          </p>
          <div className="grid gap-2">
            <label className={labelCls}>Link nguồn dữ liệu</label>
            <input
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              placeholder="https://website-doi-tac.vn/api/tai-lieu"
              className={`${inputCls} font-mono text-sm`}
            />
          </div>
          <details className="text-xs text-text-secondary bg-bg-base/50 border border-border rounded-lg p-3">
            <summary className="cursor-pointer font-medium text-text-primary">
              Link cần trả dữ liệu dạng gì?
            </summary>
            <p className="mt-2 mb-1">
              Một file JSON có danh sách tài liệu, mỗi tài liệu gồm tiêu đề và nội dung:
            </p>
            <pre className="bg-bg-surface p-3 rounded-md overflow-x-auto font-mono text-[11px] leading-relaxed">
              {FEED_EXAMPLE}
            </pre>
            <button
              onClick={copyExample}
              className="mt-2 inline-flex items-center gap-1.5 text-primary font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Đã chép!" : "Chép mẫu này"}
            </button>
          </details>
          <details className="text-xs text-text-secondary">
            <summary className="cursor-pointer">
              Tùy chọn nâng cao: đăng vào collection cụ thể
            </summary>
            <input
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              placeholder="Collection ID (để trống = Wiki mặc định)"
              className={`${inputCls} font-mono text-sm mt-2`}
            />
            <p className={`${hintCls} mt-1`}>
              Lấy ID trong link collection trên trang Wiki.
            </p>
          </details>
          <Button onClick={doSync} isLoading={syncing} disabled={!feedUrl.trim()}>
            Tải về & đăng lên Wiki
          </Button>
          <NoticeBox notice={syncNotice} />
          {syncStats && (
            <div>
              <div className="flex gap-2 flex-wrap">
                <Stat value={syncStats.fetched} label="Tải về" />
                <Stat value={syncStats.created.length} label="Đã đăng" />
                <Stat value={syncStats.skipped} label="Trùng, bỏ qua" />
                <Stat value={syncStats.failed} label="Lỗi" />
              </div>
              {syncStats.created.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {syncStats.created.map((d, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 p-3 bg-bg-surface/60 rounded-lg border border-border text-sm"
                    >
                      <span className="flex items-center gap-2 text-text-primary">
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        {d.title}
                      </span>
                      {d.url && (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary inline-flex items-center gap-1 text-[13px] shrink-0"
                        >
                          Xem <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── INGEST ── */}
      {sub === "ingest" && (
        <div className="space-y-4">
          <div className="p-5 bg-bg-surface/50 border border-border rounded-xl text-center space-y-3">
            <Database className="w-10 h-10 mx-auto text-primary opacity-80" />
            <p className="text-sm text-text-primary font-medium">
              Vừa thêm hoặc sửa tài liệu trên Wiki?
            </p>
            <p className={hintCls}>
              Bấm nút bên dưới để &ldquo;dạy&rdquo; cho AI đọc tài liệu mới.
              <br />
              Không làm bước này thì AI vẫn trả lời theo tài liệu cũ.
            </p>
            <Button onClick={doIngest} isLoading={ingesting}>
              Dạy AI đọc tài liệu mới
            </Button>
          </div>
          <NoticeBox notice={ingestNotice} />
          {ingestStats && (
            <div className="flex gap-2 flex-wrap">
              <Stat value={ingestStats.docs} label="Tài liệu đã đọc" />
              <Stat value={ingestStats.chunks} label="Đoạn kiến thức đã nạp" />
            </div>
          )}
        </div>
      )}

      {/* ── CREATE ── */}
      {sub === "create" && (
        <div className="space-y-4">
          {/* Steps */}
          <div className="flex items-center gap-1 text-xs">
            {["Soạn thảo", "Sếp duyệt", "Đăng Wiki"].map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium ${
                    i === 0
                      ? "bg-primary/10 text-primary"
                      : "text-text-muted"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-current/10 border border-current flex items-center justify-center text-[11px] font-bold">
                    {i + 1}
                  </span>
                  {s}
                </div>
                {i < 2 && <div className="flex-1 h-px bg-border mx-1" />}
              </React.Fragment>
            ))}
          </div>
          <p className={hintCls}>
            Tài liệu quan trọng nên có người kiểm duyệt: bạn soạn, sếp bấm duyệt trên
            Mattermost, hệ thống tự đăng lên Wiki.
          </p>
          <div className="grid gap-2">
            <label className={labelCls}>Tiêu đề</label>
            <input
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="Ví dụ: Quy định làm việc từ xa"
              className={inputCls}
            />
          </div>
          <div className="grid gap-2">
            <label className={labelCls}>Nội dung</label>
            <textarea
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              rows={7}
              placeholder={"Ví dụ:\n\nMục 1. Đối tượng áp dụng...\nMục 2. Quy trình đăng ký..."}
              className={`${inputCls} text-sm leading-relaxed`}
            />
            <p className={hintCls}>
              Viết văn bản thường là được, không cần biết markdown.{" "}
              {(docText.trim().length > 0) && (
                <>Đã gõ {docText.trim().length} ký tự.</>
              )}
            </p>
          </div>
          <Button
            onClick={doCreate}
            isLoading={saving}
            disabled={!docTitle.trim() || !docText.trim()}
          >
            Gửi sếp duyệt & đăng
          </Button>
          <NoticeBox notice={saveNotice} />
        </div>
      )}
    </div>
  );
};
