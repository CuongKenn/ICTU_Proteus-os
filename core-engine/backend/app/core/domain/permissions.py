# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Permission helpers (single source of truth).
# DB tồn tại 2 format permissions (list ["*"] và dict {"mod": [...]})
# nên mọi check quyền phải đi qua helper này thay vì so sánh inline.

from __future__ import annotations

ADMIN_ROLES: tuple[str, ...] = ("superadmin", "tenant_admin")
"""Role được bypass mọi kiểm tra permission chi tiết."""

_WILDCARDS: frozenset[str] = frozenset({"*", "*:*"})
"""Wildcard liệt kê mọi quyền (dạng list ["*"] hoặc dict {"*": ["*"]})."""


def has_admin_role(roles: list[str] | tuple[str, ...]) -> bool:
    """True nếu user mang role quản trị (bypass permission chi tiết)."""
    return any(r in ADMIN_ROLES for r in roles)


def has_wildcard_permission(permissions: list[str]) -> bool:
    """True nếu danh sách permission đã flatten chứa wildcard."""
    return any(p in _WILDCARDS for p in permissions)
