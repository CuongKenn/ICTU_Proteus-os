// Copyright (c) 2026 CuongKenn & ICTU Team
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Plus, Edit2, Trash2, ShieldAlert } from "lucide-react";
import api from "@/lib/api";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, string[]>;
}

const AVAILABLE_MODULES = [
  { id: "plugins", name: "Plugins", actions: ["read", "write", "install", "delete"] },
  { id: "users", name: "Users", actions: ["read", "write", "delete", "assign_role"] },
  { id: "roles", name: "Roles", actions: ["read", "write", "delete"] },
  { id: "settings", name: "Settings", actions: ["read", "write"] },
];

export const RolesTab = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [formPermissions, setFormPermissions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/v1/roles");
      setRoles(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (role?: Role) => {
    if (role) {
      setSelectedRole(role);
      setFormData({ name: role.name, description: role.description || "" });
      setFormPermissions(role.permissions || {});
    } else {
      setSelectedRole(null);
      setFormData({ name: "", description: "" });
      setFormPermissions({});
    }
    setIsModalOpen(true);
  };

  const handleTogglePermission = (module: string, action: string) => {
    setFormPermissions((prev) => {
      const modulePerms = prev[module] || [];
      if (modulePerms.includes(action)) {
        return { ...prev, [module]: modulePerms.filter((a) => a !== action) };
      } else {
        return { ...prev, [module]: [...modulePerms, action] };
      }
    });
  };

  const handleSave = async () => {
    try {
      const payload = { ...formData, permissions: formPermissions };
      if (selectedRole) {
        await api.put(`/v1/roles/${selectedRole.id}`, payload);
      } else {
        await api.post("/v1/roles", payload);
      }
      setIsModalOpen(false);
      fetchRoles();
    } catch (err: any) {
      alert("Failed to save role: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this role?")) {
      try {
        await api.delete(`/v1/roles/${id}`);
        fetchRoles();
      } catch (err: any) {
        alert("Failed to delete role: " + err.message);
      }
    }
  };

  if (isLoading) return <div className="text-text-secondary animate-pulse">Loading roles...</div>;
  if (error) return <div className="text-danger">Error: {error}</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Roles & Permissions</h2>
          <p className="text-sm text-text-secondary">
            Quản lý các Role và phân quyền (RBAC) cho Tenant của bạn.
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="shrink-0 gap-2">
          <Plus className="w-4 h-4" />
          Tạo Role Mới
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="bg-bg-surface/50 border border-border rounded-xl p-6 backdrop-blur-glass flex flex-col h-full hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary">{role.name}</h3>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleOpenModal(role)} className="p-1.5 text-text-secondary hover:text-primary transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(role.id)} className="p-1.5 text-text-secondary hover:text-danger transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <p className="text-sm text-text-secondary mb-4 flex-1">
              {role.description || "Không có mô tả."}
            </p>

            <div className="mt-auto">
              <h4 className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Phân quyền</h4>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(role.permissions || {}).length === 0 ? (
                  <span className="text-xs text-text-muted italic">Chưa có quyền nào</span>
                ) : (
                  Object.entries(role.permissions).map(([mod, actions]) => (
                    actions.map(act => (
                      <span key={`${mod}-${act}`} className="px-2 py-0.5 text-[10px] font-medium rounded bg-bg-hover text-text-primary border border-border">
                        {mod}:{act}
                      </span>
                    ))
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cấu hình Role Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedRole ? "Chỉnh sửa Role" : "Tạo Role Mới"}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Tên Role</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-primary transition-colors"
                placeholder="VD: Manager"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">Mô tả (Tùy chọn)</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-bg-surface border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-primary transition-colors"
                placeholder="Mô tả vai trò này..."
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-text-secondary">Cấu hình Permissions (Matrix)</h4>
            <div className="border border-border rounded-xl overflow-hidden bg-bg-surface/30">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-surface/50">
                    <th className="py-3 px-4 font-medium text-text-secondary w-1/3">Module</th>
                    <th className="py-3 px-4 font-medium text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {AVAILABLE_MODULES.map((mod) => (
                    <tr key={mod.id} className="hover:bg-bg-hover/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-text-primary">{mod.name}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-4">
                          {mod.actions.map(action => {
                            const isChecked = (formPermissions[mod.id] || []).includes(action);
                            return (
                              <label key={action} className="flex items-center gap-2 cursor-pointer group">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-primary border-primary text-white' : 'border-text-muted group-hover:border-primary/50 bg-transparent'}`}>
                                  {isChecked && (
                                    <svg viewBox="0 0 14 14" fill="none" className="w-3 h-3">
                                      <path d="M3 7.5L5.5 10L11 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <span className={`text-sm ${isChecked ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>{action}</span>
                                <input 
                                  type="checkbox" 
                                  className="hidden" 
                                  checked={isChecked} 
                                  onChange={() => handleTogglePermission(mod.id, action)} 
                                />
                              </label>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button onClick={handleSave}>Lưu Role</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
