// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

const ADMIN_ROLES = new Set([
  'admin',
  'tenant_admin',
  'system_admin',
  'Admin',
  'Tenant_Admin',
  'System_Admin',
  'TENANT_ADMIN',
  'SYSTEM_ADMIN',
]);

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

    // Nếu người dùng có role admin/tenant_admin/system_admin thì luôn có toàn quyền
    const hasAdminRole = user.roles.some((r) =>
      ADMIN_ROLES.has(r) || ADMIN_ROLES.has(r.toLowerCase())
    );
    if (hasAdminRole) {
      setPermissions(['*']); // Wildcard permission cho Admin
      setIsLoading(false);
      return;
    }

    try {
      // Cố gắng fetch từ API Roles
      const res = await api.get('/v1/roles');
      const allRoles = res.data;
      const userRoles = allRoles.filter(
        (r: any) =>
          user.roles.includes(r.name) ||
          user.roles.includes(r.display_name) ||
          user.roles.includes(r.code_name)
      );

      const perms = new Set<string>();
      userRoles.forEach((r: any) => {
        if (!r.permissions) return;
        if (Array.isArray(r.permissions)) {
          r.permissions.forEach((p: any) => {
            if (typeof p === 'string') {
              perms.add(p);
              // Normalize dot and colon
              perms.add(p.replace(/:/g, '.'));
              perms.add(p.replace(/\./g, ':'));
            }
          });
        } else if (typeof r.permissions === 'object') {
          Object.entries(r.permissions).forEach(([mod, actions]) => {
            if (Array.isArray(actions)) {
              actions.forEach((act) => {
                perms.add(`${mod}:${act}`);
                perms.add(`${mod}.${act}`);
              });
            } else if (typeof actions === 'string') {
              perms.add(`${mod}:${actions}`);
              perms.add(`${mod}.${actions}`);
            }
          });
        }
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
      // 1. Wildcard toàn quyền
      if (
        permissions.includes('*') ||
        permissions.includes('*:*') ||
        permissions.includes('*.*')
      ) {
        return true;
      }

      // 2. Exact match
      if (permissions.includes(requiredPermission)) return true;

      // 3. Chuẩn hóa dot (.) và colon (:)
      const normalizedWithDot = requiredPermission.replace(/:/g, '.');
      const normalizedWithColon = requiredPermission.replace(/\./g, ':');
      if (
        permissions.includes(normalizedWithDot) ||
        permissions.includes(normalizedWithColon)
      ) {
        return true;
      }

      // 4. Wildcard theo resource (vd: "plugins:*" hoặc "plugins.*")
      const parts = requiredPermission.includes(':')
        ? requiredPermission.split(':')
        : requiredPermission.split('.');
      if (parts.length >= 2) {
        const resource = parts[0];
        if (
          permissions.includes(`${resource}:*`) ||
          permissions.includes(`${resource}.*`)
        ) {
          return true;
        }
      }

      return false;
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
