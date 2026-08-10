// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Root Layout — Next.js App Router
// Áp dụng Dark Mode mặc định, Google Fonts Inter.

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: "Proteus OS — Hệ điều hành Đa năng cho Tổ chức",
  description:
    "Nền tảng quản trị doanh nghiệp thế hệ mới: tích hợp AI, Workflow tự động hóa và BI Analytics trong một hệ sinh thái thống nhất.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark">
      <body className={`${inter.className} bg-bg-base text-text-primary antialiased`}>
        {children}
      </body>
    </html>
  );
}
