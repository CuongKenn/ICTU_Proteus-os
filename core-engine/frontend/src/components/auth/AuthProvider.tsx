// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import api from "@/lib/api";
import { logger } from "@/lib/logger";

function AuthSync() {
  const { data: session, status } = useSession();
  const { setUser, clearAuth, setLoading } = useAuthStore();

  useEffect(() => {
    if (status === "loading") {
      setLoading(true);
      return;
    }
    if (status === "authenticated" && session?.user) {
      const initialUser = {
        id: session.user.id ?? "",
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        image: session.user.image ?? undefined,
        tenantId: session.user.tenant_id ?? "",
        roles: session.user.roles ?? [],
      };
      setUser(initialUser);

      // Fetch actual roles from Database — MERGE với Keycloak realm roles
      // (tenant_admin/superadmin) thay vì ghi đè: /me chỉ trả roles fine-grained
      // trong DB, ghi đè sẽ làm mất quyền admin ở UI (ẩn icon n8n/Metabase...).
      api.get("/v1/auth/me")
        .then((res) => {
          if (res.data && res.data.roles) {
            setUser({
              ...initialUser,
              roles: Array.from(
                new Set([...(initialUser.roles ?? []), ...(res.data.roles ?? [])])
              ),
            });
          }
        })
        .catch((err) => {
          logger.warn("Could not fetch DB roles, fallback to Keycloak roles", err);
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
