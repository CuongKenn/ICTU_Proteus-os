// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "var(--paper)",
          raised: "var(--paper-raised)",
          white: "var(--paper-white)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
        },
        muted: "var(--muted)",
        dim: "var(--dim)",
        ghost: "var(--ghost)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          glow: "var(--accent-glow)",
        },
        line: {
          DEFAULT: "var(--line)",
          hi: "var(--line-hi)",
          focus: "var(--line-focus)",
        },
        plate: {
          DEFAULT: "var(--plate)",
          soft: "var(--plate-soft)",
          border: "var(--plate-border)",
        },
        // Semantic
        semantic: {
          cyan: "var(--cyan)",
          emerald: "var(--emerald)",
          amber: "var(--amber)",
          rose: "var(--rose)",
          violet: "var(--violet)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        heading: ["var(--font-space-grotesk)", "Space Grotesk", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        display: ["Dancing Script", "cursive"],
      },
      fontSize: {
        hero: ["clamp(2.5rem, 5vw, 3.75rem)", { lineHeight: "1.08", letterSpacing: "-0.025em" }],
        meta: ["0.5625rem", { letterSpacing: "0.16em" }],
      },
      maxWidth: {
        container: "var(--container-max)",
      },
      gap: {
        bento: "var(--bento-gap)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        elevated: "var(--shadow-elevated)",
        modal: "var(--shadow-modal)",
      },
      borderRadius: {
        card: "14px",
      },
      animation: {
        "fade-in": "fade-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-up": "slide-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-down": "slide-down 0.3s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
