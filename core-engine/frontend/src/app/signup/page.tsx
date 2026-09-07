// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { Suspense } from "react";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Đăng ký SaaS — Proteus OS",
  description: "Đăng ký không gian làm việc số cho doanh nghiệp của bạn trên Proteus OS.",
};

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-bg-base">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
