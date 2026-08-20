// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",  // Match toàn bộ src/ bao gồm hooks/, store/, lib/
  ],
  darkMode: "class", // Dark mode mặc định (theo AGENTS.md §2)
  theme: {
    extend: {
      colors: {
        // Design Tokens từ docs/ui_ux_design.md §5
        "bg-base": "var(--color-bg-base)",
        "bg-surface": "var(--color-bg-surface)",
        "bg-glass": "var(--color-bg-glass)",
        "bg-hover": "var(--color-bg-hover)",
        border: "var(--color-border)",
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        accent: "var(--color-accent)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "text-disabled": "var(--color-text-disabled)",
        "text-muted": "var(--color-text-disabled)",
        "brand-primary": "var(--color-primary)",
        "border-subtle": "hsla(220, 60%, 60%, 0.08)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      fontSize: {
        xs: ['var(--text-xs)', '1rem'],
        sm: ['var(--text-sm)', '1.25rem'],
        base: ['var(--text-base)', '1.5rem'],
        lg: ['var(--text-lg)', '1.75rem'],
        xl: ['var(--text-xl)', '1.75rem'],
        '2xl': ['var(--text-2xl)', '2rem'],
        '3xl': ['var(--text-3xl)', '2.25rem'],
      },
      // spacing overrides removed (using default Tailwind rem scale)
      backdropBlur: {
        glass: "12px",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
