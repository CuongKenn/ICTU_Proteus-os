// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { UserPlus, UserMinus, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
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
}


interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
}

export const UsersTab = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Assign role modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        api.get("/v1/users"),
        api.get("/v1/roles"),
      ]);
      setUsers(usersRes.data);
      setRoles(rolesRes.data);
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

  const handleInvite = async () => {
    if (!inviteEmail || !inviteFullName) return;
    setInviting(true);
    setInviteError(null);
    try {
      await api.post("/v1/users/invite", {
        email: inviteEmail,
        full_name: inviteFullName,
      });
      setInviteSuccess(true);
      await fetchData(); // Refresh list
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

  const handleDeactivate = async (userId: string) => {
    if (!confirm("Bạn có chắc muốn vô hiệu hóa tài khoản này? Họ sẽ mất quyền truy cập ngay lập tức.")) return;
    try {
      await api.patch(`/v1/users/${userId}/deactivate`);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: false } : u));
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Không thể vô hiệu hóa tài khoản.";
      alert(detail);
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
    try {
      await api.post(`/v1/roles/${selectedRoleId}/assign`, {
        user_id: selectedUser.id,
      });
      setIsRoleModalOpen(false);
      alert("Gán Role thành công!");
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Không thể gán role.");
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

  return (
    <div className="space-y-8 animate-fade-in">
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

      <div className="bg-bg-surface/50 border border-border rounded-xl overflow-hidden backdrop-blur-glass">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg-surface/30">
                <th className="py-3 px-4 text-sm font-medium text-text-secondary">Tên & Email</th>
                <th className="py-3 px-4 text-sm font-medium text-text-secondary">Vai trò</th>
                <th className="py-3 px-4 text-sm font-medium text-text-secondary">Trạng thái</th>

                <th className="py-3 px-4 text-sm font-medium text-text-secondary text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-text-secondary">
                    Chưa có nhân viên nào. Bấm &quot;Mời nhân viên&quot; để bắt đầu.

                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-bg-hover/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-text-primary">{user.full_name || "(Chưa đặt tên)"}</div>
                      <div className="text-sm text-text-secondary">{user.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      {user.roles && user.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                              {role}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-text-secondary italic">Chưa có</span>
                      )}
                    </td>
                    <td className="py-3 px-4">

                      <span className={`px-2 py-1 text-xs rounded-md font-medium ${
                        user.is_active
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}>
                        {user.is_active ? "Đang hoạt động" : "Vô hiệu hóa"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {user.is_active && (
                        <>
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
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
