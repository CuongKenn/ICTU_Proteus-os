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
            "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300",
            selectedCategory === "All"
              ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20 scale-105"
              : "bg-bg-surface-elevated text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary"
          )}
        >
          Tất cả
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className={clsx(
              "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300",
              selectedCategory === category
                ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20 scale-105"
                : "bg-bg-surface-elevated text-text-secondary hover:bg-bg-surface-hover hover:text-text-primary"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative w-full md:w-72 shrink-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-text-muted" />
        </div>
        <input
          type="text"
          placeholder="Tìm kiếm ứng dụng..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pl-10 pr-4 py-2.5 bg-bg-surface-elevated border border-border/50 rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all shadow-sm"
        />
      </div>
    </div>
  );
};
