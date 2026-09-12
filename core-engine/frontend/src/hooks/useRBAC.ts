// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

/**
 * Chuẩn hóa permissions của role về string[] phẳng.
 * DB tồn tại 2 format: object {"mod": ["act"]} và list legacy ["*"].
 * (Xem backend app/core/domain/permissions.py — cùng quy ước.)
 */
export const normalizeRolePermissions = (permissions: unknown): string[] => {
  if (!permissions) return [];
  if (Array.isArray(permissions)) return permissions.map(String);
  if (typeof permissions === "object") {
    const out: string[] = [];
    Object.entries(permissions as Record<string, unknown>).forEach(([mod, actions]) => {
      if (Array.isArray(actions)) {
        (actions as unknown[]).forEach((act) => out.push(`${mod}:${String(act)}`));
      }
    });
    return out;
  }
  return [];
};

/**
 * Hook custom để kiểm tra Role và Permission (RBAC) trên Frontend.
 */
export const useRBAC = () => {
  const { user, hasRole } = useAuthStore();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user || !user.roles || user.roles.length === 0) {
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    // Tạm thời nếu là Admin thì luôn cấp toàn quyền (Fallback)
    if (user.roles.includes('Admin')) {
      setPermissions(['*']); // Wildcard permission cho Admin
      setIsLoading(false);
      return;
    }

    try {
      // Cố gắng fetch từ API Roles (nếu Backend có hỗ trợ lấy danh sách role để parse)
      const res = await api.get('/v1/roles');
      const allRoles = res.data;
      const userRoles = allRoles.filter((r: any) => user.roles.includes(r.name) || user.roles.includes(r.display_name));

      const perms = new Set<string>();
      userRoles.forEach((r: any) => {
        normalizeRolePermissions(r.permissions).forEach((p) => perms.add(p));
      });
      setPermissions(Array.from(perms));
    } catch (err) {
      logger.warn("Could not fetch specific permissions for roles, relying on Role names only.");
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback(
    (requiredPermission: string) => {
      if (permissions.includes('*') || permissions.includes('*:*')) return true;
      return permissions.includes(requiredPermission);
    },
    [permissions]
  );

  return {
    roles: user?.roles || [],
    permissions,
    hasRole,
    hasPermission,
    isLoading,
  };
};
