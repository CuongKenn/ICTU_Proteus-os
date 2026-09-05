-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Proteus OS — PostgreSQL Core Schema Initialization
-- File này chạy tự động khi container PostgreSQL khởi động lần đầu.
-- Tham chiếu: docs/erd.md
--
-- LƯU Ý:
--   - File này chỉ tạo schema Core (Platform-level).
--   - Plugin schema (hr_, finance_, ...) được tạo bởi Plugin Manager khi cài đặt.
--   - Row-Level Security (RLS) Policy được áp dụng sau bởi Plugin Manager.

-- ─────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Full-text search support

-- ─────────────────────────────────────────────────────────────
-- SCHEMA SEPARATION
-- Mỗi service OSS có schema riêng để tránh xung đột với Core
-- ─────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS keycloak;
CREATE SCHEMA IF NOT EXISTS n8n;
-- Metabase requires a dedicated database to avoid liquibase clashes with Core tables
-- We handle CREATE DATABASE outside of this script if needed, or assume it's created.
-- We will just remove the schema metabase here.
-- Outline requires a dedicated database to avoid Sequelize schema bugs
-- We handle CREATE DATABASE outside of this script if needed, or assume it's created.
CREATE SCHEMA IF NOT EXISTS mattermost;

-- ─────────────────────────────────────────────────────────────
-- BẢNG: TENANTS
-- Đại diện cho một Tổ chức/Khách hàng trong hệ thống
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,  -- VD: "ictu", "viettel"
    keycloak_realm  VARCHAR(100) NOT NULL UNIQUE,  -- Tên Realm trong Keycloak
    plan            VARCHAR(50)  NOT NULL DEFAULT 'starter',  -- starter | pro | enterprise
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ  -- Soft delete
);

COMMENT ON TABLE tenants IS 'Bảng lưu thông tin Tenant (Tổ chức). Mỗi Tenant có 1 Keycloak Realm riêng.';
COMMENT ON COLUMN tenants.slug IS 'Định danh ngắn gọn, dùng trong URL. Ví dụ: app.proteus.io/t/ictu';
COMMENT ON COLUMN tenants.deleted_at IS 'Soft delete — NULL = còn hoạt động, NOT NULL = đã bị xóa.';

-- ─────────────────────────────────────────────────────────────
-- BẢNG: USERS
-- Mirror của Keycloak User. Lưu metadata bổ sung.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY,              -- Đồng bộ với Keycloak User ID (sub)
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    email           VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,                   -- Soft delete
    UNIQUE(tenant_id, email)
);

COMMENT ON TABLE users IS 'Mirror của Keycloak User. ID đồng bộ với sub claim trong JWT.';
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─────────────────────────────────────────────────────────────
-- BẢNG: PLUGINS
-- Danh mục Plugin trên Marketplace (Platform-level, không theo Tenant)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plugins (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_name       VARCHAR(100) NOT NULL UNIQUE,  -- VD: "hr-module", "finance-module"
    display_name    VARCHAR(255) NOT NULL,
    description     TEXT,
    version         VARCHAR(50)  NOT NULL,
    author          VARCHAR(255),
    license         VARCHAR(50)  NOT NULL DEFAULT 'AGPL-3.0',
    icon_url        TEXT,
    manifest_url    TEXT NOT NULL,                 -- URL tải manifest.yaml
    is_official     BOOLEAN NOT NULL DEFAULT FALSE,
    download_count  INTEGER NOT NULL DEFAULT 0,
    published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ                    -- Soft delete
);

COMMENT ON TABLE plugins IS 'Danh mục Plugin trên Marketplace. Mỗi Plugin có 1 manifest.yaml.';
COMMENT ON COLUMN plugins.code_name IS 'Định danh duy nhất dạng kebab-case. Dùng làm prefix cho bảng DB của Plugin.';

-- Index tối ưu cho query Marketplace (ORDER BY is_official DESC, download_count DESC)
CREATE INDEX IF NOT EXISTS idx_plugins_marketplace
    ON plugins(is_official DESC, download_count DESC)
    WHERE deleted_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- BẢNG: TENANT_PLUGIN
-- Trạng thái cài đặt Plugin theo từng Tenant
-- ─────────────────────────────────────────────────────────────
CREATE TYPE plugin_status AS ENUM (
    'INSTALLING',
    'ACTIVE',
    'FAILED_DIRTY',
    'DISABLED',
    'UNINSTALLING',
    'DELETED'
);

CREATE TABLE IF NOT EXISTS tenant_plugins (
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    plugin_id           UUID NOT NULL REFERENCES plugins(id) ON DELETE RESTRICT,
    status              plugin_status NOT NULL DEFAULT 'INSTALLING',
    installed_version   VARCHAR(50),
    config_override     JSONB DEFAULT '{}',         -- Ghi đè default_config của Plugin
    install_error_log   TEXT,                       -- Stacktrace nếu status = FAILED_DIRTY
    installed_by_user_id UUID REFERENCES users(id),
    installed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, plugin_id)
);

COMMENT ON TABLE tenant_plugins IS 'Quan hệ M-N giữa Tenant và Plugin. Ghi nhận trạng thái cài đặt và cấu hình.';
CREATE INDEX IF NOT EXISTS idx_tenant_plugins_status ON tenant_plugins(status);

-- ─────────────────────────────────────────────────────────────
-- BẢNG: ROLES
-- Plugin-level roles. Tạo bởi Plugin Manager khi cài đặt.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plugin_id       UUID REFERENCES plugins(id) ON DELETE CASCADE,  -- NULL = Core role
    name            VARCHAR(100) NOT NULL,          -- VD: "hr_manager"
    display_name    VARCHAR(255),
    description     TEXT,
    permissions     JSONB NOT NULL DEFAULT '[]',    -- ["hr:employees:read", ...]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

COMMENT ON TABLE roles IS 'Plugin-level roles với fine-grained permissions. Keycloak chỉ lưu tên role.';
CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON roles(tenant_id);

-- ─────────────────────────────────────────────────────────────
-- BẢNG: USER_ROLES
-- Quan hệ nhiều-nhiều giữa User và Role
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id             UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE user_roles IS 'Phân quyền cụ thể của người dùng trong Tenant.';
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- ─────────────────────────────────────────────────────────────
-- BẢNG: AUDIT_LOG
-- Nhật ký tất cả hành động trong hệ thống
-- ─────────────────────────────────────────────────────────────
CREATE TYPE actor_type AS ENUM ('HUMAN', 'AI_AGENT', 'SYSTEM');

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    actor_id        UUID,                           -- user_id hoặc NULL nếu SYSTEM
    actor_type      actor_type NOT NULL,
    action          VARCHAR(255) NOT NULL,          -- VD: "plugin.install", "user.deactivate"
    resource_type   VARCHAR(100),                   -- VD: "Plugin", "User"
    resource_id     UUID,
    command_id      UUID,                           -- FK → ai_commands.id (nếu do AI thực hiện)
    metadata        JSONB DEFAULT '{}',
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail. Không có deleted_at — không được xóa.';
COMMENT ON COLUMN audit_logs.command_id IS 'Nếu do AI Agent thực hiện, trỏ đến bản ghi AI_COMMAND tương ứng.';
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- BẢNG: AI_COMMANDS
-- Lịch sử DX-DSL Command từ AI Orchestrator
-- ─────────────────────────────────────────────────────────────
CREATE TYPE ai_command_status AS ENUM (
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'EXECUTING',
    'COMPLETED',
    'FAILED',
    'TIMEOUT'
);

CREATE TABLE IF NOT EXISTS ai_commands (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    issued_by_user_id   UUID NOT NULL REFERENCES users(id),
    session_id          UUID NOT NULL,
    dsl_payload         JSONB NOT NULL,             -- Toàn bộ DX-DSL JSON
    action              VARCHAR(255) NOT NULL,       -- VD: "hr.leave_requests.batch_approve"
    effect              VARCHAR(20)  NOT NULL,       -- read | write | critical
    status              ai_command_status NOT NULL DEFAULT 'PENDING_APPROVAL',
    dry_run_result      JSONB,
    approval_deadline   TIMESTAMPTZ,
    approved_by         UUID REFERENCES users(id),  -- Người phê duyệt 1
    second_approver     UUID REFERENCES users(id),  -- Người phê duyệt 2 (nếu critical)
    mattermost_msg_id   VARCHAR(255),               -- ID tin nhắn Mattermost gửi xin phê duyệt
    execution_result    JSONB,
    executed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_commands IS 'Lịch sử DX-DSL Command. Tách riêng khỏi audit_log để query phê duyệt hiệu quả.';
CREATE INDEX IF NOT EXISTS idx_ai_commands_tenant_id ON ai_commands(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_commands_status ON ai_commands(status);
CREATE INDEX IF NOT EXISTS idx_ai_commands_deadline ON ai_commands(approval_deadline)
    WHERE status = 'PENDING_APPROVAL';

-- ───────────────────────────────────────────────────────────────
-- TRIGGER: auto-update updated_at (và last_updated_at)
-- ───────────────────────────────────────────────────────────────
-- Hàm cho các bảng dùng cột "updated_at" (tenants, users, plugins)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Hàm riêng cho bảng tenant_plugins dùng cột "last_updated_at" (khác với updated_at)
CREATE OR REPLACE FUNCTION update_last_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_plugins_updated_at
    BEFORE UPDATE ON plugins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Dùng hàm riêng vì cột là last_updated_at, không phải updated_at
CREATE TRIGGER set_tenant_plugins_updated_at
    BEFORE UPDATE ON tenant_plugins
    FOR EACH ROW EXECUTE FUNCTION update_last_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY (RLS) CHO CORE TABLES
-- ─────────────────────────────────────────────────────────────
-- Bật RLS cho tất cả các bảng có tenant_id
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_commands ENABLE ROW LEVEL SECURITY;

-- Tạo Policy áp dụng cho toàn bộ thao tác dựa trên biến session
CREATE POLICY tenant_isolation_policy_users ON users
    FOR ALL TO PUBLIC USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy_tenant_plugins ON tenant_plugins
    FOR ALL TO PUBLIC USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy_roles ON roles
    FOR ALL TO PUBLIC USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy_audit_logs ON audit_logs
    FOR ALL TO PUBLIC USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy_ai_commands ON ai_commands
    FOR ALL TO PUBLIC USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ─────────────────────────────────────────────────────────────
-- BẢNG: TENANT_INTEGRATIONS
-- Cấu hình tích hợp các dịch vụ bên ngoài (VD: GitHub, Slack, vv)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_integrations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider        VARCHAR(50) NOT NULL,
    config          JSONB NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant_id ON tenant_integrations(tenant_id);

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy_tenant_integrations ON tenant_integrations
    FOR ALL TO PUBLIC USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
