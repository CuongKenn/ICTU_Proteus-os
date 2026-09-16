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
  Blocks,
  Box,
  FileText,
  LayoutGrid,
  MessageSquare,
  Network,
  Search,
  Server,
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
        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
          active
            ? "border-amber-400/50 bg-amber-400/15"
            : "border-transparent bg-bg-base/40 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
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

  return (
    <div className="relative min-h-screen font-display">
      {/* Dynamic Background Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-primary/10 via-bg-base to-bg-base -z-10 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-brand-primary/5 to-transparent -z-10 pointer-events-none" />

      <div className="p-6 sm:p-10 max-w-7xl mx-auto relative z-0">
        {/* ─── Header ─── */}
        <div className="mb-8 animate-fade-in">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-2">
                Chào buổi {greeting},{" "}
                <span className="gradient-text">{session?.user?.name || "bạn"}</span>
              </h1>
              <p className="text-text-secondary">
                Hôm nay là{" "}
                {new Date().toLocaleDateString("vi-VN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2" aria-label="Thống kê launchpad">
              <span className="inline-flex items-center gap-1.5 rounded-full glass-card px-3 py-1.5 text-xs font-semibold text-text-secondary">
                <LayoutGrid className="h-3.5 w-3.5 text-brand-primary" />
                {roleVisiblePlugins.length + visibleSystemApps.length} ứng dụng
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full glass-card px-3 py-1.5 text-xs font-semibold text-text-secondary">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                {activeCount} đang hoạt động
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full glass-card px-3 py-1.5 text-xs font-semibold text-text-secondary">
                <Star className="h-3.5 w-3.5 text-amber-400" />
                {favorites.length} yêu thích
              </span>
            </div>
          </div>

          {/* ─── Toolbar: tìm kiếm + lọc ─── */}
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm ứng dụng..."
                  aria-label="Tìm ứng dụng"
                  className="w-full rounded-xl glass-card py-2.5 pl-10 pr-10 text-sm text-text-primary placeholder:text-text-disabled outline-none transition-all duration-200 focus:border-brand-primary/70 focus:shadow-[0_0_0_3px_hsla(245,85%,65%,0.15)]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Xóa tìm kiếm"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFavOnly((v) => !v)}
                aria-pressed={favOnly}
                className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary active:scale-95 ${
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
              <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Lọc theo danh mục">
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
            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-5 flex items-center gap-2">
              <Server className="h-4 w-4 text-brand-primary" />
              Hệ thống
              <div className="flex-1 h-px bg-border/50" />
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleSystemApps.map((app) => (
                <AppIcon
                  key={app.id}
                  appName={app.name}
                  description={app.description}
                  tone={app.tone}
                  icon={app.renderIcon()}
                  isActive
                  onClick={() => openSystemApp(app)}
                  topRight={favoriteButton(`sys:${app.id}`, app.name)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ─── Plugin Apps Section ─── */}
        <section className="animate-fade-in" style={{ animationDelay: "200ms" }} aria-label="Ứng dụng cài đặt">
          <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-5 flex items-center gap-2">
            <Blocks className="h-4 w-4 text-brand-primary" />
            Ứng dụng cài đặt
            <div className="flex-1 h-px bg-border/50" />
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Plugin Skeletons */}
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl glass-card p-4 animate-pulse-slow" aria-hidden="true">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-bg-surface/60 border border-border/50 shrink-0" />
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
              visiblePlugins.map((plugin: Plugin) => (
                <AppIcon
                  key={plugin.id}
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
              ))}
          </div>
        </section>

        {/* ─── Không kết quả: gợi ý thay vì ngõ cụt (UX guideline) ─── */}
        {showNoResult && (
          <div className="mt-14 text-center animate-fade-in" role="status">
            <div className="relative mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-bg-surface/50 border border-border/50">
              <div className="absolute inset-0 rounded-full bg-brand-primary/5 blur-xl" />
              <Search className="relative z-10 h-9 w-9 text-brand-primary/70" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-text-primary">
              Không tìm thấy ứng dụng phù hợp
            </h3>
            <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-text-secondary">
              Thử từ khóa khác, ví dụ “wiki”, “chat”, “báo cáo” — hoặc xóa bộ lọc để xem toàn bộ.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="cursor-pointer rounded-lg bg-brand-primary/10 px-5 py-2.5 font-semibold text-brand-primary transition-all border border-brand-primary/20 hover:bg-brand-primary/20 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                Xóa tìm kiếm & bộ lọc
              </button>
              <button
                type="button"
                onClick={() => router.push("/marketplace")}
                className="cursor-pointer rounded-lg px-5 py-2.5 font-semibold text-text-secondary transition-all border border-border hover:text-text-primary hover:bg-bg-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                Khám phá Marketplace
              </button>
            </div>
          </div>
        )}

        {/* Empty State for Plugins */}
        {showEmptyPlugins && !hasFilter && (
          <div className="mt-20 text-center animate-fade-in">
            <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-bg-surface/50 border border-border/50 text-text-secondary/40 mb-6 group hover:border-brand-primary/50 transition-colors">
              <div className="absolute inset-0 rounded-full bg-brand-primary/5 blur-xl group-hover:bg-brand-primary/10 transition-colors" />
              <Blocks className="w-12 h-12 relative z-10 text-brand-primary/60 group-hover:text-brand-primary transition-colors" />
            </div>
            <h3 className="text-2xl font-bold text-text-primary mb-3">Chưa có Plugin nào</h3>
            <p className="text-text-secondary max-w-sm mx-auto leading-relaxed mb-6">
              Không gian làm việc của bạn chưa được cài đặt bất kỳ công cụ nào. Hãy truy cập Marketplace để khám phá thêm.
            </p>
            <button
              onClick={() => router.push("/marketplace")}
              className="px-6 py-2.5 rounded-lg bg-brand-primary/10 text-brand-primary font-semibold hover:bg-brand-primary/20 transition-all border border-brand-primary/20 hover:scale-105 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Khám phá Marketplace
            </button>
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
