// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class", // Dark mode mặc định (theo AGENTS.md §2)
  theme: {
    extend: {
      colors: {
        // Design Tokens từ docs/ui_ux_design.md §5
        "bg-primary": "hsl(225, 30%, 8%)",       // --color-bg-primary
        "bg-secondary": "hsl(225, 25%, 12%)",     // --color-bg-secondary
        "bg-glass": "hsla(225, 30%, 100%, 0.05)", // --color-bg-glass
        "accent-primary": "hsl(252, 100%, 67%)",  // --color-accent-primary (Neon Purple)
        "accent-secondary": "hsl(196, 100%, 50%)",// --color-accent-secondary (Cyan)
        "text-primary": "hsl(0, 0%, 95%)",        // --color-text-primary
        "text-secondary": "hsl(225, 15%, 65%)",   // --color-text-secondary
        "border-subtle": "hsla(225, 30%, 100%, 0.08)", // --color-border-subtle
        "success": "hsl(142, 71%, 45%)",
        "warning": "hsl(38, 92%, 50%)",
        "error": "hsl(0, 84%, 60%)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
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
