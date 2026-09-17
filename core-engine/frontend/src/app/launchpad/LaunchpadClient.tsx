// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { usePlugins } from "@/hooks/usePlugins";
import { AppIcon, type AppTone } from "@/components/ui/AppIcon";
import { useSession } from "next-auth/react";

import { useNotificationStore } from "@/store/notificationStore";
import {
  AppWindow,
  ArrowRight,
  Blocks,
  Box,
  Clock,
  Compass,
  FileText,
  LayoutGrid,
  MessageSquare,
  Network,
  Search,
  Server,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import type { Plugin } from "@/types";

/** Chỉ cho phép http/https để chống open-redirect / javascript: trong iframe. */
function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : undefined);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const FAVORITES_KEY = "proteus:launchpad:favorites";
const RECENT_KEY = "proteus:launchpad:recent";
const MAX_RECENT = 20;

function readStringArray(key: string): string[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeStringArray(key: string, values: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // localStorage đầy / bị chặn — bỏ qua, không chặn UX.
  }
}

interface SystemApp {
  id: string;
  name: string;
  description: string;
  tone: AppTone;
  adminOnly: boolean;
  renderIcon: () => React.ReactNode;
}

const SYSTEM_APPS: SystemApp[] = [
  {
    id: "mattermost",
    name: "Mattermost",
    description: "Nhắn tin, kênh nhóm và họp video nội bộ.",
    tone: "blue",
    adminOnly: false,
    renderIcon: () => <MessageSquare className="h-6 w-6" />,
  },
  {
    id: "outline",
    name: "Outline Wiki",
    description: "Tài liệu, sổ tay và tri thức dùng chung.",
    tone: "cyan",
    adminOnly: false,
    renderIcon: () => <FileText className="h-6 w-6" />,
  },
  {
    id: "n8n",
    name: "n8n Workflow",
    description: "Tự động hoá quy trình liên phòng ban.",
    tone: "orange",
    adminOnly: true,
    renderIcon: () => <Network className="h-6 w-6" />,
  },
  {
    id: "metabase",
    name: "Metabase",
    description: "Báo cáo, dashboard và phân tích số liệu.",
    tone: "brand",
    adminOnly: true,
    renderIcon: () => <Box className="h-6 w-6" />,
  },
  {
    id: "appsmith",
    name: "Appsmith",
    description: "Xây màn hình quản trị low-code nhanh.",
    tone: "violet",
    adminOnly: true,
    renderIcon: () => <AppWindow className="h-6 w-6" />,
  },
];

const PLUGIN_TONES: AppTone[] = ["emerald", "blue", "violet", "orange", "rose", "cyan"];

function toneForPlugin(codeName: string): AppTone {
  let hash = 0;
  for (let i = 0; i < codeName.length; i++) hash = (hash * 31 + codeName.charCodeAt(i)) >>> 0;
  return PLUGIN_TONES[hash % PLUGIN_TONES.length];
}

function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.toLowerCase().trim());
}

export function LaunchpadClient() {
  const { data: session } = useSession();
  const user = useAuthStore((state) => state.user); // Bắt buộc subscribe vào user để component re-render khi roles được cập nhật
  const hasRole = useAuthStore((state) => state.hasRole);
  const isAdmin = hasRole("tenant_admin") || hasRole("superadmin");
  const { plugins, isLoading } = usePlugins();
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [favorites, setFavorites] = useState<string[]>(() => readStringArray(FAVORITES_KEY));
  const [recent, setRecent] = useState<string[]>(() => readStringArray(RECENT_KEY));
  const addToast = useNotificationStore((state) => state.addToast);
  const router = useRouter();

  // Env đọc tại runtime (trong component) để nhận đúng giá trị deploy-time,
  // không bake cứng proteus.local ở module-scope. Fallback "" an toàn:
  // nút iframe sẽ bị disable/toast thay vì trỏ nhầm domain.
  const MATTERMOST_URL = useMemo(() => process.env.NEXT_PUBLIC_MATTERMOST_URL || "", []);
  const OUTLINE_URL = useMemo(() => process.env.NEXT_PUBLIC_OUTLINE_URL || "", []);
  const N8N_URL = useMemo(() => process.env.NEXT_PUBLIC_N8N_URL || "", []);
  const APPSMITH_URL = useMemo(() => process.env.NEXT_PUBLIC_APPSMITH_URL || "", []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeApp) closeIframe();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [activeApp]);

  const recordOpen = useCallback((id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((v) => v !== id)].slice(0, MAX_RECENT);
      writeStringArray(RECENT_KEY, next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => {
        const next = prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id];
        writeStringArray(FAVORITES_KEY, next);
        return next;
      });
    },
    []
  );

  const openIframe = (appId: string, url: string) => {
    if (!isSafeHttpUrl(url)) {
      addToast("error", "URL ứng dụng chưa được cấu hình hoặc không hợp lệ.");
      return;
    }
    recordOpen(appId);
    setActiveApp(appId);
    setIframeUrl(url);
    setIsIframeLoading(true);
  };

  const handleOpenMetabase = async () => {
    setIsIframeLoading(true);
    setActiveApp("metabase");
    try {
      const res = await fetch("/api/embed/metabase?dashboard_id=1");
      if (!res.ok) throw new Error("Failed to fetch signed URL");
      const data = await res.json();
      if (!data?.url || !isSafeHttpUrl(data.url)) {
        throw new Error("Invalid signed URL");
      }
      recordOpen("metabase");
      setIframeUrl(data.url);
    } catch (err) {
      addToast("error", "Không thể tải báo cáo Metabase");
      setActiveApp(null);
      setIframeUrl(null);
      setIsIframeLoading(false);
    }
  };

  const closeIframe = () => {
    setActiveApp(null);
    setIframeUrl(null);
    setIsIframeLoading(false);
  };

  const handleOpenPlugin = (code_name: string) => {
    const plugin = plugins.find((p) => p.code_name === code_name);
    if (plugin?.external_url && isSafeHttpUrl(plugin.external_url)) {
      openIframe(code_name, plugin.external_url);
    } else if (APPSMITH_URL) {
      const appsmithUrl = `${APPSMITH_URL.replace(/\/+$/, "")}/app/${encodeURIComponent(code_name)}`;
      openIframe(code_name, appsmithUrl);
    } else {
      addToast("error", "URL ứng dụng chưa được cấu hình.");
    }
  };

  const openSystemApp = (app: SystemApp) => {
    switch (app.id) {
      case "mattermost":
        recordOpen(app.id);
        router.push("/chat");
        break;
      case "outline":
        recordOpen(app.id);
        router.push("/wiki");
        break;
      case "n8n":
        openIframe("n8n", N8N_URL);
        break;
      case "metabase":
        void handleOpenMetabase();
        break;
      case "appsmith":
        openIframe("appsmith", APPSMITH_URL);
        break;
    }
  };

  // ─── Lọc + sắp xếp ──────────────────────────────────────────────
  const visibleSystemApps = useMemo(
    () =>
      SYSTEM_APPS.filter((app) => {
        if (app.adminOnly && !isAdmin) return false;
        if (favOnly && !favorites.includes(`sys:${app.id}`)) return false;
        if (query.trim() && !matchesQuery(`${app.name} ${app.description}`, query)) return false;
        return true;
      }),
    [isAdmin, favOnly, favorites, query]
  );

  const roleVisiblePlugins = useMemo(
    () =>
      plugins.filter((plugin) => {
        if (isAdmin) return true;
        if (!plugin.roles || plugin.roles.length === 0) return true;
        return plugin.roles.some((r) => hasRole(r));
      }),
    [plugins, isAdmin, hasRole]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    roleVisiblePlugins.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [roleVisiblePlugins]);

  const rankOf = useCallback(
    (id: string) => {
      const fav = favorites.includes(id) ? 0 : 1;
      const rec = recent.indexOf(id);
      return { fav, rec: rec === -1 ? Number.MAX_SAFE_INTEGER : rec };
    },
    [favorites, recent]
  );

  const visiblePlugins = useMemo(() => {
    const q = query.trim();
    const list = roleVisiblePlugins.filter((plugin) => {
      if (favOnly && !favorites.includes(plugin.code_name)) return false;
      if (category !== "all" && plugin.category !== category) return false;
      if (
        q &&
        !matchesQuery(
          `${plugin.display_name} ${plugin.code_name} ${plugin.category ?? ""}`,
          q
        )
      )
        return false;
      return true;
    });
    return [...list].sort((a, b) => {
      const ra = rankOf(a.code_name);
      const rb = rankOf(b.code_name);
      if (ra.fav !== rb.fav) return ra.fav - rb.fav;
      if (ra.rec !== rb.rec) return ra.rec - rb.rec;
      return a.display_name.localeCompare(b.display_name, "vi");
    });
  }, [roleVisiblePlugins, favOnly, favorites, category, query, rankOf]);

  const activeCount = useMemo(
    () => roleVisiblePlugins.filter((p) => p.status === "ACTIVE").length,
    [roleVisiblePlugins]
  );

  const hasFilter = query.trim() !== "" || favOnly || category !== "all";
  const showEmptyPlugins = !isLoading && plugins.length === 0;
  const showNoResult = !isLoading && !showEmptyPlugins && visibleSystemApps.length === 0 && visiblePlugins.length === 0;

  const clearFilters = () => {
    setQuery("");
    setFavOnly(false);
    setCategory("all");
  };

  const favoriteButton = (id: string, label: string) => {
    const active = favorites.includes(id);
    return (
      <button
        type="button"
        aria-label={`Yêu thích ${label}`}
        aria-pressed={active}
        title={active ? "Bỏ ghim khỏi yêu thích" : "Ghim vào yêu thích"}
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(id);
        }}
        className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
          active
            ? "border-amber-400/50 bg-amber-400/15"
            : "border-transparent bg-bg-base/60 opacity-0 backdrop-blur-sm group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:opacity-100"
        }`}
      >
        <Star
          className={`h-4 w-4 transition-colors duration-200 ${
            active ? "fill-amber-400 text-amber-400" : "text-text-secondary hover:text-amber-300"
          }`}
        />
      </button>
    );
  };

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "sáng" : greetingHour < 18 ? "chiều" : "tối";
  const todayLabel = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const totalApps = roleVisiblePlugins.length + visibleSystemApps.length;
  const recentItems = recent
    .map((id) => {
      if (id.startsWith("sys:")) {
        const app = SYSTEM_APPS.find((a) => `sys:${a.id}` === id);
        return app ? { id, label: app.name, kind: "sys" as const, target: app } : null;
      }
      const plugin = roleVisiblePlugins.find((p) => p.code_name === id);
      return plugin ? { id, label: plugin.display_name, kind: "plugin" as const, target: plugin } : null;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .slice(0, 6);

  const reopenRecent = (item: (typeof recentItems)[number]) => {
    if (item.kind === "sys") openSystemApp(item.target);
    else handleOpenPlugin(item.target.code_name);
  };

  return (
    <div className="relative min-h-screen font-display">
      {/* Dynamic Background Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-primary/10 via-bg-base to-bg-base -z-10 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-brand-primary/5 to-transparent -z-10 pointer-events-none" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 right-[-120px] -z-10 h-[320px] w-[320px] rounded-full bg-brand-secondary/10 blur-[100px]" />

      <div className="p-6 sm:p-10 max-w-7xl mx-auto relative z-0">
        {/* ─── Hero chào mừng (Bento) ─── */}
        <div className="mb-8 animate-fade-in">
          <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-bg-surface via-bg-surface/80 to-bg-base p-6 sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-primary/15 blur-[80px]" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-brand-secondary/10 blur-[80px]" />
            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0 max-w-xl">
                <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-brand-primary/25 bg-brand-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Không gian làm việc
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-2 text-balance">
                  Chào buổi {greeting},{" "}
                  <span className="gradient-text">{session?.user?.name || "bạn"}</span>
                </h1>
                <p className="text-sm text-text-secondary">
                  Hôm nay là {todayLabel} — mọi công cụ của bạn ở ngay bên dưới, sẵn sàng để mở.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => router.push("/marketplace")}
                    className="btn-shine inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_hsla(245,85%,65%,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
                  >
                    <Compass className="h-4 w-4" />
                    Khám phá Marketplace
                  </button>
                  <button
                    type="button"
                    onClick={() => document.getElementById("launchpad-search")?.focus()}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-bg-glass px-4 py-2.5 text-sm font-semibold text-text-secondary backdrop-blur-glass transition-all duration-200 hover:border-brand-primary/50 hover:text-text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    <Search className="h-4 w-4" />
                    Tìm nhanh
                    <kbd className="rounded-md border border-border/60 bg-bg-base px-1.5 py-0.5 font-mono text-[11px] text-text-disabled">/</kbd>
                  </button>
                </div>
              </div>
              <div className="grid shrink-0 grid-cols-3 gap-2.5 sm:gap-3" aria-label="Thống kê launchpad">
                <div className="rounded-2xl border border-border/60 bg-bg-glass px-4 py-3 text-center backdrop-blur-glass">
                  <div className="flex items-center justify-center gap-1.5 text-brand-primary">
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                  <div className="mt-1 font-display text-xl font-extrabold text-text-primary">{totalApps}</div>
                  <div className="text-[11px] font-semibold text-text-secondary">ứng dụng</div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-bg-glass px-4 py-3 text-center backdrop-blur-glass">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
                  </div>
                  <div className="mt-1 font-display text-xl font-extrabold text-text-primary">{activeCount}</div>
                  <div className="text-[11px] font-semibold text-text-secondary">đang hoạt động</div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-bg-glass px-4 py-3 text-center backdrop-blur-glass">
                  <div className="flex items-center justify-center gap-1.5 text-amber-400">
                    <Star className="h-4 w-4" />
                  </div>
                  <div className="mt-1 font-display text-xl font-extrabold text-text-primary">{favorites.length}</div>
                  <div className="text-[11px] font-semibold text-text-secondary">yêu thích</div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Truy cập gần đây ─── */}
          {recentItems.length > 0 && !hasFilter && (
            <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Mở gần đây">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-disabled">
                <Clock className="h-3.5 w-3.5" />
                Gần đây
              </span>
              {recentItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => reopenRecent(item)}
                  className="inline-flex max-w-[180px] cursor-pointer items-center gap-1.5 truncate rounded-full border border-border/60 bg-bg-glass px-3 py-1.5 text-xs font-semibold text-text-secondary backdrop-blur-glass transition-all duration-200 hover:-translate-y-px hover:border-brand-primary/50 hover:text-text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ─── Toolbar: tìm kiếm + lọc ─── */}
          <div className="mt-5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <input
                  id="launchpad-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).focus();
                    }
                  }}
                  placeholder="Tìm ứng dụng, ví dụ “wiki”, “chat”, “báo cáo”…"
                  aria-label="Tìm ứng dụng"
                  className="w-full rounded-2xl glass-card py-3 pl-11 pr-10 text-sm text-text-primary placeholder:text-text-disabled outline-none transition-all duration-200 focus:border-brand-primary/70 focus:shadow-[0_0_0_3px_hsla(245,85%,65%,0.15)]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Xóa tìm kiếm"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1.5 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFavOnly((v) => !v)}
                aria-pressed={favOnly}
                className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary active:scale-95 ${
                  favOnly
                    ? "border-amber-400/60 bg-amber-400/15 text-amber-300"
                    : "glass-card text-text-secondary hover:text-text-primary"
                }`}
              >
                <Star className={`h-4 w-4 ${favOnly ? "fill-amber-400 text-amber-400" : ""}`} />
                Yêu thích
              </button>
            </div>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo danh mục">
                <FilterPill active={category === "all"} label="Tất cả" onClick={() => setCategory("all")} />
                {categories.map((c) => (
                  <FilterPill key={c} active={category === c} label={c} onClick={() => setCategory(c)} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── System Apps Section ─── */}
        {visibleSystemApps.length > 0 && (
          <section className="mb-10 animate-fade-in" style={{ animationDelay: "100ms" }} aria-label="Ứng dụng hệ thống">
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-5 flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary/10 ring-1 ring-brand-primary/20">
                <Server className="h-4 w-4 text-brand-primary" />
              </span>
              Hệ thống
              <span className="rounded-full border border-border/60 bg-bg-glass px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                {visibleSystemApps.length}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-border/70 to-transparent" />
            </h2>
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {visibleSystemApps.map((app, i) => (
                <div key={app.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 60, 300)}ms` }}>
                <AppIcon
                  appName={app.name}
                  description={app.description}
                  tone={app.tone}
                  icon={app.renderIcon()}
                  isActive
                  onClick={() => openSystemApp(app)}
                  topRight={favoriteButton(`sys:${app.id}`, app.name)}
                />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Plugin Apps Section ─── */}
        <section className="animate-fade-in" style={{ animationDelay: "200ms" }} aria-label="Ứng dụng cài đặt">
          <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-5 flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary/10 ring-1 ring-brand-primary/20">
              <Blocks className="h-4 w-4 text-brand-primary" />
            </span>
            Ứng dụng cài đặt
            {!isLoading && visiblePlugins.length > 0 && (
              <span className="rounded-full border border-border/60 bg-bg-glass px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                {visiblePlugins.length}
              </span>
            )}
            <div className="h-px flex-1 bg-gradient-to-r from-border/70 to-transparent" />
          </h2>

          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Plugin Skeletons */}
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl glass-card p-5 animate-pulse-slow" aria-hidden="true">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="rounded-2xl bg-bg-surface/60 border border-border/50 shrink-0" style={{ height: 52, width: 52 }} />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 rounded bg-bg-surface/60 w-3/4" />
                      <div className="h-2.5 rounded bg-bg-surface/40 w-1/2" />
                    </div>
                  </div>
                  <div className="h-2.5 rounded bg-bg-surface/40 w-full" />
                  <div className="mt-2 h-2.5 rounded bg-bg-surface/40 w-2/3" />
                </div>
              ))}

            {/* Plugins */}
            {!isLoading &&
              visiblePlugins.map((plugin: Plugin, i) => (
                <div key={plugin.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 50, 300)}ms` }}>
                <AppIcon
                  appName={plugin.display_name}
                  description={
                    plugin.category
                      ? `${plugin.category} · v${plugin.version}`
                      : `Phiên bản ${plugin.version}`
                  }
                  tone={toneForPlugin(plugin.code_name)}
                  icon={<Blocks className="h-6 w-6" />}
                  onClick={() => handleOpenPlugin(plugin.code_name)}
                  isActive={plugin.status === "ACTIVE"}
                  topRight={favoriteButton(plugin.code_name, plugin.display_name)}
                />
                </div>
              ))}
          </div>
        </section>

        {/* ─── Không kết quả: gợi ý thay vì ngõ cụt (UX guideline) ─── */}
        {showNoResult && (
          <div className="mt-10 rounded-3xl border border-border/60 bg-bg-surface/40 p-10 text-center animate-fade-in sm:mt-14" role="status">
            <div className="relative mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl border border-brand-primary/25 bg-gradient-to-br from-brand-primary/15 to-brand-secondary/10">
              <div className="absolute inset-0 rounded-3xl bg-brand-primary/5 blur-xl" />
              <Search className="relative z-10 h-9 w-9 text-brand-primary" />
            </div>
            <h3 className="mb-2 font-display text-xl font-extrabold text-text-primary">
              Không tìm thấy ứng dụng phù hợp
            </h3>
            <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-text-secondary">
              Thử từ khóa khác, ví dụ “wiki”, “chat”, “báo cáo” — hoặc xóa bộ lọc để xem toàn bộ {totalApps} ứng dụng.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_hsla(245,85%,65%,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
              >
                Xóa tìm kiếm & bộ lọc
              </button>
              <button
                type="button"
                onClick={() => router.push("/marketplace")}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-bg-glass px-5 py-2.5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-brand-primary/50 hover:text-text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                Khám phá Marketplace
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Empty State for Plugins */}
        {showEmptyPlugins && !hasFilter && (
          <div className="mt-10 rounded-3xl border border-dashed border-border/70 bg-bg-surface/30 p-10 text-center animate-fade-in sm:p-14">
            <div className="group relative mx-auto mb-6 inline-flex h-24 w-24 items-center justify-center rounded-[28px] border border-brand-primary/25 bg-gradient-to-br from-brand-primary/15 via-bg-surface to-brand-secondary/10 transition-colors hover:border-brand-primary/50">
              <div className="absolute inset-0 rounded-[28px] bg-brand-primary/5 blur-xl transition-colors group-hover:bg-brand-primary/10" />
              <Blocks className="relative z-10 h-11 w-11 text-brand-primary transition-colors" />
            </div>
            <h3 className="mb-3 font-display text-2xl font-extrabold text-text-primary">Chưa có Plugin nào</h3>
            <p className="mx-auto mb-2 max-w-md text-sm leading-relaxed text-text-secondary">
              Không gian làm việc của bạn chưa được cài đặt bất kỳ công cụ nào. 5 ứng dụng hệ thống ở trên vẫn dùng bình thường.
            </p>
            <p className="mx-auto mb-7 max-w-md text-sm leading-relaxed text-text-disabled">
              Hãy truy cập Marketplace để khám phá thêm — cài trong 1 chạm, gỡ bất cứ lúc nào.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                onClick={() => router.push("/marketplace")}
                className="btn-shine inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_-8px_hsla(245,85%,65%,0.6)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
              >
                <Compass className="h-4 w-4" />
                Khám phá Marketplace
              </button>
              <button
                onClick={() => router.push("/ai")}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-bg-glass px-5 py-3 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-brand-primary/50 hover:text-text-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <Sparkles className="h-4 w-4" />
                Hỏi Proteus AI
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Iframe Overlay */}
      {activeApp && iframeUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-bg-base/95 backdrop-blur-2xl animate-fade-in">
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-bg-surface/40 shadow-sm">
            <h2 className="text-lg font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
              {activeApp === "metabase" ? (
                <><Box className="w-5 h-5 text-brand-primary" /> Metabase Analytics</>
              ) : activeApp === "n8n" ? (
                <><Network className="w-5 h-5 text-orange-500" /> n8n Workflow</>
              ) : activeApp === "appsmith" ? (
                <><AppWindow className="w-5 h-5 text-purple-400" /> Appsmith Low-code</>
              ) : (
                <><Blocks className="w-5 h-5 text-brand-primary" /> {plugins.find((p) => p.code_name === activeApp)?.display_name || activeApp}</>
              )}
            </h2>
            <button
              onClick={closeIframe}
              className="p-2 rounded-full hover:bg-bg-surface/80 text-text-secondary hover:text-text-primary transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              title="Đóng (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Iframe Content */}
          <div className="flex-1 relative bg-bg-base">
            {isIframeLoading && (
               <div className="absolute inset-0 flex items-center justify-center bg-bg-base z-10 animate-pulse-slow">
                 <div className="flex flex-col items-center gap-4">
                   <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                   <div className="text-text-secondary font-medium tracking-wide">Đang tải ứng dụng...</div>
                 </div>
               </div>
            )}
            <iframe
              src={iframeUrl}
              className="w-full h-full border-none"
              onLoad={() => setIsIframeLoading(false)}
              onError={() => {
                setIsIframeLoading(false);
                addToast("error", "Không thể tải ứng dụng trong iframe.");
              }}
              allow="clipboard-read; clipboard-write; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              referrerPolicy="strict-origin-when-cross-origin"
              title={activeApp}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
        active
          ? "border-brand-primary/70 bg-brand-primary/15 text-brand-primary"
          : "border-border/60 bg-transparent text-text-secondary hover:border-brand-primary/40 hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}
