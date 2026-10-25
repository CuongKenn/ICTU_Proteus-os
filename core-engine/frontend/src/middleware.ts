// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Middleware bảo vệ route — dùng chung tên session cookie với authOptions
// (sessionCookie.ts) để không lệch sau khi đổi tên cookie có version.

import { withAuth } from "next-auth/middleware";
import { sessionCookieName } from "@/lib/sessionCookie";

export default withAuth({
  cookies: {
    sessionToken: {
      name: sessionCookieName(),
    },
  },
});

export const config = {
  matcher: [
    "/((?!$|login|signup|api/auth|api/onboarding|_next/static|_next/image|favicon.ico).*)",
  ],
};
