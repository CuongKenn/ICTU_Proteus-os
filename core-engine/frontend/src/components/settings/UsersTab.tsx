// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { UserPlus, UserMinus, ShieldAlert, MoreVertical } from "lucide-react";

// Mock Data cho UI
const MOCK_USERS = [
  { id: "1", name: "Nguyễn Thành Trung", email: "trungnt@proteus.local", roles: ["Admin", "Developer"], status: "Active" },
  { id: "2", name: "Hoàng Mạnh Cường", email: "cuonghm@proteus.local", roles: ["Admin", "System"], status: "Active" },
  { id: "3", name: "Trần Văn A", email: "anv@proteus.local", roles: ["User"], status: "Inactive" },
];

const MOCK_ROLES = ["Admin", "Developer", "User", "Manager", "System"];

export const UsersTab = () => {
  const [users, setUsers] = useState(MOCK_USERS);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const handleDelete = (id: string) => {
    // Soft delete mock
    setUsers(users.map(u => u.id === id ? { ...u, status: "Deleted" } : u));
  };

  const openRoleModal = (user: any) => {
    setSelectedUser(user);
    setIsRoleModalOpen(true);
  };

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
          Mời người dùng
        </Button>
      </div>

      <div className="bg-bg-surface/50 border border-border rounded-xl overflow-hidden backdrop-blur-glass">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg-surface/30">
                <th className="py-3 px-4 text-sm font-medium text-text-secondary">Tên & Email</th>
                <th className="py-3 px-4 text-sm font-medium text-text-secondary">Roles (Vai trò)</th>
                <th className="py-3 px-4 text-sm font-medium text-text-secondary">Trạng thái</th>
                <th className="py-3 px-4 text-sm font-medium text-text-secondary text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-bg-hover/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-text-primary">{user.name}</div>
                    <div className="text-sm text-text-secondary">{user.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map(r => (
                        <span key={r} className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">
                          {r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs rounded-md ${user.status === 'Active' ? 'bg-green-500/10 text-green-500' : user.status === 'Inactive' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => openRoleModal(user)}>
                      Gán Role
                    </Button>
                    <Button variant="danger" className="px-3 py-1.5 text-sm" onClick={() => handleDelete(user.id)} disabled={user.status === 'Deleted'}>
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Mời người dùng mới">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">Nhập email người dùng bạn muốn mời vào Tenant này.</p>
          <input
            type="email"
            placeholder="email@example.com"
            className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-primary transition-colors"
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
            <Button variant="secondary" onClick={() => setIsInviteModalOpen(false)}>Hủy</Button>
            <Button onClick={() => setIsInviteModalOpen(false)}>Gửi lời mời</Button>
          </div>
        </div>
      </Modal>

      {/* Assign Role Modal */}
      <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} title="Gán Role cho Người Dùng">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Đang cấu hình cho: <strong className="text-text-primary">{selectedUser?.name}</strong>
          </p>
          <div className="space-y-2">
            {MOCK_ROLES.map(role => (
              <label key={role} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-bg-surface/30 cursor-pointer hover:bg-bg-hover transition-colors">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-primary focus:ring-primary/20" 
                  defaultChecked={selectedUser?.roles?.includes(role)} 
                />
                <span className="text-text-primary">{role}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border mt-4">
            <Button variant="secondary" onClick={() => setIsRoleModalOpen(false)}>Hủy</Button>
            <Button onClick={() => setIsRoleModalOpen(false)}>Lưu thay đổi</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
