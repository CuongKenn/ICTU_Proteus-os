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
          className={clsx(
            "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary active:scale-95",
            selectedCategory === "All"
              ? "bg-indigo-600 text-white shadow-sm dark:bg-brand-primary"
              : "bg-white text-slate-500 border border-slate-200 shadow-sm hover:border-indigo-300 hover:text-slate-900 dark:bg-bg-surface-elevated dark:text-text-secondary dark:border-transparent dark:shadow-none dark:hover:bg-bg-surface-hover dark:hover:text-text-primary"
          )}
        >
          Tất cả
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className={clsx(
              "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary active:scale-95",
              selectedCategory === category
                ? "bg-indigo-600 text-white shadow-sm dark:bg-brand-primary"
                : "bg-white text-slate-500 border border-slate-200 shadow-sm hover:border-indigo-300 hover:text-slate-900 dark:bg-bg-surface-elevated dark:text-text-secondary dark:border-transparent dark:shadow-none dark:hover:bg-bg-surface-hover dark:hover:text-text-primary"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative w-full md:w-72 shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400 dark:text-text-muted" />
        </div>
        <input
          type="text"
          placeholder="Tìm kiếm ứng dụng..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all shadow-sm dark:bg-bg-surface-elevated dark:border-border/50 dark:text-text-primary dark:placeholder-text-muted dark:focus:ring-brand-primary/50 dark:focus:border-brand-primary"
        />
      </div>
    </div>
  );
};
