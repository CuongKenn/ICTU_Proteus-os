// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React from "react";
import clsx from "clsx";
import { Search } from "lucide-react";

export interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
      {/* Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide shrink-0">
        <button
          onClick={() => onSelectCategory("All")}
          className="btn-sm font-mono text-meta whitespace-nowrap transition-all"
          style={{
            background: selectedCategory === "All" ? "var(--ink)" : "transparent",
            color: selectedCategory === "All" ? "var(--paper)" : "var(--muted)",
            border: `1px solid ${selectedCategory === "All" ? "var(--ink)" : "var(--line-hi)"}`,
            borderRadius: "6px",
          }}
        >
          Tất cả
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className="btn-sm font-mono text-meta whitespace-nowrap transition-all"
            style={{
              background: selectedCategory === category ? "var(--ink)" : "transparent",
              color: selectedCategory === category ? "var(--paper)" : "var(--muted)",
              border: `1px solid ${selectedCategory === category ? "var(--ink)" : "var(--line-hi)"}`,
              borderRadius: "6px",
            }}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full md:w-72 shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-4 w-4" style={{ color: "var(--dim)" }} />
        </div>
        <input
          type="text"
          placeholder="Tìm kiếm ứng dụng..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-field input-field-icon"
        />
      </div>
    </div>
  );
};
