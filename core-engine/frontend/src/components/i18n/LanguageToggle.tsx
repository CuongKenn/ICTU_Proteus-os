// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import { useLang } from "@/components/i18n/LanguageContext";

export const LanguageToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { lang, setLang } = useLang();

  return (
    <button
      onClick={() => setLang(lang === "vi" ? "en" : "vi")}
      className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium tracking-wider uppercase transition-colors duration-200 ${className || ""}`}
      style={{
        color: "var(--muted)",
        border: "1px solid var(--line-hi)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--ink)";
        e.currentTarget.style.borderColor = "var(--ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--muted)";
        e.currentTarget.style.borderColor = "var(--line-hi)";
      }}
      title={lang === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}
      aria-label="Toggle language"
    >
      {lang === "vi" ? "EN" : "VI"}
    </button>
  );
};
