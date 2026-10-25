// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

/**
 * Role được bypass mọi kiểm tra permission (khớp ADMIN_ROLES backend).
 * Keycloak realm role (tenant_admin/superadmin) + role admin legacy.
 */
const ADMIN_ROLES = ['superadmin', 'tenant_admin', 'admin', 'Admin'];

/** Chuẩn hoá permissions về list string, hỗ trợ cả 2 format DB:
 *  - list: ["*"] hoặc ["hr:employees:read", ...]
 *  - dict: {"roles": ["read","write"]} hoặc {"allowed": [...]} */
function normalizePermissions(raw: unknown): string[] {
  const out = new Set<string>();
  if (!raw) return [];
  if (Array.isArray(raw)) {
    raw.forEach((p) => out.add(String(p)));
    return Array.from(out);
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.allowed)) {
      (obj.allowed as unknown[]).forEach((p) => out.add(String(p)));
      return Array.from(out);
    }
    Object.entries(obj).forEach(([mod, actions]) => {
      if (Array.isArray(actions)) {
        (actions as unknown[]).forEach((act) => out.add(`${mod}:${act}`));
      } else if (actions === true) {
        out.add(mod);
      }
    });
  }
  return Array.from(out);
}

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

    // Admin (tenant_admin/superadmin) luôn full quyền — khớp backend.
    if (user.roles.some((r) => ADMIN_ROLES.includes(r))) {
      setPermissions(['*']);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.get('/v1/roles');
      const allRoles = Array.isArray(res.data) ? res.data : [];
      const userRoles = allRoles.filter(
        (r: any) =>
          user.roles.includes(r.name) || user.roles.includes(r.display_name)
      );

      const perms = new Set<string>();
      userRoles.forEach((r: any) => {
        normalizePermissions(r.permissions).forEach((p) => perms.add(p));
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
      // Admin theo role luôn pass, kể cả trước khi fetch xong.
      if (user?.roles?.some((r) => ADMIN_ROLES.includes(r))) return true;
      if (permissions.includes('*')) return true;
      return permissions.includes(requiredPermission);
    },
    [permissions, user]
  );

  // Role tự tạo (VD accountant) có đủ quyền finance:* nhưng khác tên role
  // trong manifest — kiểm tra theo prefix để hiện đúng plugin (khớp logic
  // _require_prefix_perm của backend: prefix = plugin_code.split("-")[0] + ":").
  const hasPermissionPrefix = useCallback(
    (prefix: string) => {
      if (user?.roles?.some((r) => ADMIN_ROLES.includes(r))) return true;
      if (permissions.includes('*')) return true;
      return permissions.some((p) => p === prefix || p.startsWith(prefix));
    },
    [permissions, user]
  );

  return {
    roles: user?.roles || [],
    permissions,
    hasRole,
    hasPermission,
    hasPermissionPrefix,
    isLoading,
  };
};
