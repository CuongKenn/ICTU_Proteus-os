// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

function AuthSync() {
  const { data: session, status } = useSession();
  const { setUser, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    if (status === "loading") {
      setLoading(true);
      return;
    }
    if (status === "authenticated" && session?.user) {
      setUser({
        id: session.user.id ?? "",
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        image: session.user.image ?? undefined,
        tenantId: (session.user as any).tenant_id ?? "",
        roles: (session.user as any).roles ?? [],
      });
    } else {
      clearAuth();
    }
  }, [session, status, setUser, clearAuth, setLoading]);

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthSync />
      {children}
    </SessionProvider>
  );
}
