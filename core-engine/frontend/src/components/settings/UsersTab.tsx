// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  UserPlus,
  UserMinus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Search,
  ChevronDown,
  Users as UsersIcon,
  UserCheck,
  Clock,
  Ban,
  Mail,
} from "lucide-react";
import api from "@/lib/api";
import { logger } from "@/lib/logger";

interface User {
  id: string;
  tenant_id: string;
  keycloak_id: string | null;
  email: string;
  full_name: string | null;
  roles: string[];
  is_active: boolean;
  last_login_at?: string | null;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
}

type StatusFilter = "all" | "active" | "pending" | "disabled";
type UserStatus = "active" | "pending" | "disabled";

const AVATAR_STYLES = [
  "bg-primary/15 text-primary",
  "bg-emerald-500/15 text-success",
  "bg-amber-500/15 text-warning",
  "bg-sky-500/15 text-info",
  "bg-rose-500/15 text-danger",
  "bg-violet-500/15 text-semantic-violet",
];

function avatarStyle(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
}

function initialsOf(user: User): string {
  const name = (user.full_name || "").trim();
  if (name) {
    const parts = name.split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }
  return (user.email[0] || "?").toUpperCase();
}

/** pending = chưa từng đăng nhập (is_active=False + last_login_at=None) */
function statusOf(user: User): UserStatus {
  if (user.is_active) return "active";
  return user.last_login_at ? "disabled" : "pending";
}

const STATUS_META: Record<UserStatus, { label: string; className: string }> = {
  active: { label: "Đang hoạt động", className: "bg-success/10 text-success" },
  pending: { label: "Chờ kích hoạt", className: "bg-warning/10 text-warning" },
  disabled: { label: "Vô hiệu hóa", className: "bg-danger/10 text-danger" },
};

export const UsersTab = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search + filter
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Expanded row (detail)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Assign role modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Global action messages
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const clearMessages = () => {
    setActionSuccess(null);
    setActionError(null);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        api.get("/v1/users"),
        api.get("/v1/roles"),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
    } catch (err) {
      logger.error("Failed to fetch users/roles", err);
      setError("Không thể tải danh sách người dùng. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const total = users.length;
    let active = 0, pending = 0, disabled = 0;
    users.forEach((u) => {
      const s = statusOf(u);
      if (s === "active") active++;
      else if (s === "pending") pending++;
      else disabled++;
    });
    return { total, active, pending, disabled };
  }, [users]);

  // Map mã role (name) -> tên hiển thị (display_name). Backend trả roles
  // là mảng `name` (VD tenant_admin), UI phải hiện display_name
  // (VD Quản trị viên) thay vì mã thô.
  const roleDisplay = useMemo(() => {
    const m = new Map<string, string>();
    roles.forEach((r) => m.set(r.name, r.display_name || r.name));
    return m;
  }, [roles]);

  const displayRole = useCallback(
    (code: string) => roleDisplay.get(code) || code,
    [roleDisplay]
  );

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !`${u.full_name || ""} ${u.email}`.toLowerCase().includes(q)) return false;
      if (roleFilter !== "all" && !(Array.isArray(u.roles) && u.roles.includes(roleFilter))) return false;
      if (statusFilter !== "all" && statusOf(u) !== statusFilter) return false;
      return true;
    });
  }, [users, query, roleFilter, statusFilter]);

  const handleInvite = async () => {
    if (!inviteEmail || !inviteFullName) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await api.post("/v1/users/invite", {
        email: inviteEmail,
        full_name: inviteFullName,
      });
      await fetchData(); // Refresh list
      // Backend trả email_sent=false khi SMTP fail — không được báo thành công giả.
      if (res.data?.email_sent === false) {
        setInviteError(
          res.data?.email_warning ||
            "Tài khoản đã được tạo nhưng chưa gửi được email mời. Hãy cấu hình SMTP rồi thử 'Gửi lại lời mời'."
        );
        return;
      }
      setInviteSuccess(true);
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteSuccess(false);
        setInviteEmail("");
        setInviteFullName("");
      }, 2000);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Có lỗi xảy ra khi gửi lời mời.";
      setInviteError(detail);
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvite = async (user: User) => {
    clearMessages();
    setResendingId(user.id);
    try {
      const res = await api.post(`/v1/users/${user.id}/resend-invite`);
      if (res.data?.email_sent === false) {
        setActionError(
          res.data?.email_warning || "Chưa gửi được email mời. Kiểm tra cấu hình SMTP."
        );
      } else {
        setActionSuccess(`Đã gửi lại email mời cho ${user.email}!`);
      }
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Không thể gửi lại lời mời.");
    } finally {
      setResendingId(null);
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm("Bạn có chắc muốn vô hiệu hóa tài khoản này? Họ sẽ mất quyền truy cập ngay lập tức.")) return;
    clearMessages();
    try {
      await api.patch(`/v1/users/${userId}/deactivate`);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: false } : u));
      setActionSuccess("Vô hiệu hóa tài khoản thành công!");
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Không thể vô hiệu hóa tài khoản.";
      setActionError(detail);
    }
  };

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setSelectedRoleId(roles[0]?.id || "");
    setIsRoleModalOpen(true);
  };

  const handleAssignRole = async () => {
    if (!selectedUser || !selectedRoleId) return;
    setAssigning(true);
    clearMessages();
    try {
      await api.post(`/v1/roles/${selectedRoleId}/assign`, {
        user_id: selectedUser.id,
      });
      setIsRoleModalOpen(false);
      setActionSuccess(`Gán Role thành công cho ${selectedUser.full_name || selectedUser.email}!`);
      fetchData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Không thể gán role.");
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-text-secondary mt-4">Đang tải danh sách người dùng...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-10 h-10 text-error" />
        <p className="text-error">{error}</p>
        <Button variant="secondary" onClick={fetchData}>Thử lại</Button>
      </div>
    );
  }

  const statCards = [
    { label: "Tổng nhân sự", value: stats.total, icon: UsersIcon, className: "bg-primary/15 text-primary" },
    { label: "Đang hoạt động", value: stats.active, icon: UserCheck, className: "bg-success/15 text-success" },
    { label: "Chờ kích hoạt", value: stats.pending, icon: Clock, className: "bg-warning/15 text-warning" },
    { label: "Vô hiệu hóa", value: stats.disabled, icon: Ban, className: "bg-danger/15 text-danger" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Quản lý Người Dùng</h2>
          <p className="text-sm text-text-secondary">
            Danh sách tài khoản, phân quyền và trạng thái hoạt động trong Tenant của bạn.
          </p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)} className="shrink-0 gap-2">
          <UserPlus className="w-4 h-4" />
          Mời nhân viên
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border bg-bg-surface/50 px-4 py-3.5 backdrop-blur-glass">
            <div className={`p-2 rounded-lg ${s.className}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold text-text-primary leading-tight">{s.value}</div>
              <div className="text-xs text-text-secondary">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {actionError && (
        <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{actionError}</p>
        </div>
      )}

      {actionSuccess && (
        <div className="bg-success/10 border border-success text-success px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-sm">{actionSuccess}</p>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled pointer-events-none" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-bg-surface/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-bg-surface/50 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
          aria-label="Lọc theo vai trò"
        >
          <option value="all">Tất cả vai trò</option>
          {roles.map((r) => (
            <option key={r.id} value={r.name}>{r.display_name || r.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-bg-surface/50 border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary transition-colors"
          aria-label="Lọc theo trạng thái"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="pending">Chờ kích hoạt</option>
          <option value="disabled">Vô hiệu hóa</option>
        </select>
      </div>

      {/* Row list */}
      <div className="rounded-xl border border-border bg-bg-surface/50 backdrop-blur-glass overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-text-secondary">
            {users.length === 0
              ? <>Chưa có nhân viên nào. Bấm &quot;Mời nhân viên&quot; để bắt đầu.</>
              : "Không tìm thấy người dùng phù hợp bộ lọc."}
          </div>
        ) : (
          <ul className="divide-y divide-border/70">
            {filteredUsers.map((user) => {
              const st = statusOf(user);
              const meta = STATUS_META[st];
              const isOpen = expandedId === user.id;
              const userRoles = Array.isArray(user.roles) ? user.roles : [];
              return (
                <li key={user.id}>
                  <button
                    onClick={() => setExpandedId(isOpen ? null : user.id)}
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-bg-hover/40 ${isOpen ? "bg-bg-hover/30" : ""}`}
                    aria-expanded={isOpen}
                  >
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarStyle(user.email)}`}>
                      {initialsOf(user)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium text-text-primary truncate">
                        {user.full_name || "(Chưa đặt tên)"}
                      </span>
                      <span className="block text-sm text-text-secondary truncate">{user.email}</span>
                    </span>
                    <span className="hidden md:flex items-center gap-1.5 max-w-[280px] overflow-hidden">
                      {userRoles.length > 0 ? (
                        <>
                          {userRoles.slice(0, 2).map((role, idx) => (
                            <span key={idx} title={role} className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                              {displayRole(role)}
                            </span>
                          ))}
                          {userRoles.length > 2 && (
                            <span className="text-xs text-text-muted whitespace-nowrap">+{userRoles.length - 2}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-text-muted italic">Chưa có vai trò</span>
                      )}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-md font-medium whitespace-nowrap ${meta.className}`}>
                      {meta.label}
                    </span>
                    <ChevronDown className={`w-4 h-4 shrink-0 text-text-disabled transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 pl-[68px] animate-fade-in">
                      <div className="rounded-lg border border-border/70 bg-bg-base/40 p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="block text-xs text-text-muted mb-0.5">Email</span>
                            <span className="text-text-primary">{user.email}</span>
                          </div>
                          <div>
                            <span className="block text-xs text-text-muted mb-0.5">Trạng thái</span>
                            <span className={`inline-block px-2 py-0.5 text-xs rounded-md font-medium ${meta.className}`}>
                              {meta.label}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="block text-xs text-text-muted mb-1.5">
                            Vai trò ({userRoles.length})
                          </span>
                          {userRoles.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {userRoles.map((role, idx) => (
                                <span key={idx} title={role} className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                                  {displayRole(role)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-text-secondary italic">Chưa được gán vai trò nào</span>
                          )}
                        </div>
                        {user.is_active && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              variant="secondary"
                              className="px-3 py-1.5 text-sm"
                              onClick={() => openRoleModal(user)}
                            >
                              Gán Role
                            </Button>
                            <Button
                              variant="danger"
                              className="px-3 py-1.5 text-sm"
                              onClick={() => handleDeactivate(user.id)}
                            >
                              <UserMinus className="w-4 h-4" />
                              Vô hiệu hóa
                            </Button>
                          </div>
                        )}
                        {!user.is_active && st === "pending" && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              variant="secondary"
                              className="px-3 py-1.5 text-sm"
                              onClick={() => handleResendInvite(user)}
                              disabled={resendingId === user.id}
                            >
                              {resendingId === user.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4" />
                              )}
                              Gửi lại lời mời
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          setInviteError(null);
          setInviteSuccess(false);
          setInviteEmail("");
          setInviteFullName("");
        }}
        title="Mời nhân viên mới"
        onConfirm={!inviteSuccess ? handleInvite : undefined}
        confirmLabel="Gửi lời mời"
        isConfirmLoading={inviting}
      >
        {inviteSuccess ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle2 className="w-12 h-12 text-success" />
            <p className="text-center text-text-primary font-medium">
              Email mời đã được gửi!
            </p>
            <p className="text-center text-sm text-text-secondary">
              Nhân viên sẽ nhận được email để tự đặt mật khẩu và đăng nhập.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Nhân viên sẽ nhận được email với đường link để tự đặt mật khẩu và kích hoạt tài khoản.
            </p>
            {inviteError && (
              <div className="p-3 bg-error/10 text-error rounded-lg border border-error/20 text-sm">
                {inviteError}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Họ và tên
                </label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1">
                  Email công ty
                </label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Role Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="Gán Role cho Người Dùng"
        onConfirm={handleAssignRole}
        confirmLabel="Lưu thay đổi"
        isConfirmLoading={assigning}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Đang cấu hình cho: <strong className="text-text-primary">{selectedUser?.full_name || selectedUser?.email}</strong>
          </p>
          {roles.length === 0 ? (
            <p className="text-text-secondary text-sm">Chưa có Role nào. Hãy tạo Role tại tab Roles trước.</p>
          ) : (
            <div className="space-y-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg-surface/30 cursor-pointer hover:bg-bg-hover transition-colors">
                  <input
                    type="radio"
                    name="role"
                    value={role.id}
                    checked={selectedRoleId === role.id}
                    onChange={() => setSelectedRoleId(role.id)}
                    className="w-4 h-4 text-primary focus:ring-primary/20"
                  />
                  <div>
                    <span className="text-text-primary font-medium">{role.display_name || role.name}</span>
                    {role.description && (
                      <p className="text-xs text-text-secondary">{role.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
