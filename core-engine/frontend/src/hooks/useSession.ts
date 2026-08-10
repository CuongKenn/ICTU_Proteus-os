// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// useSession — Custom Hook wrap next-auth/react useSession

import { useSession as useNextAuthSession } from "next-auth/react";
import { useCallback } from "react";

export interface SessionUser {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  roles?: string[];
  tenant_id?: string;
  [key: string]: any;
}

export interface UseSessionReturn {
  user: SessionUser | null;
  status: "authenticated" | "loading" | "unauthenticated";
  isLoading: boolean;
  hasRole: (role: string) => boolean;
}

export function useSession(): UseSessionReturn {
  const { data: session, status } = useNextAuthSession();

  const user = (session?.user as SessionUser) || null;
  const isLoading = status === "loading";

  const hasRole = useCallback(
    (role: string): boolean => {
      if (!user || !user.roles || !Array.isArray(user.roles)) {
        return false;
      }
      return user.roles.includes(role);
    },
    [user]
  );

  return {
    user,
    status,
    isLoading,
    hasRole,
  };
}
