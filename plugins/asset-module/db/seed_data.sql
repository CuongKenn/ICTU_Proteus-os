-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Asset Module — Database Seed
--
-- QUY ƯỚC QUAN TRỌNG: file này là runtime DDL — install chạy nó TRONG schema
-- riêng của tenant (tenant_<uuid>, search_path đã set sẵn) nên mọi CREATE/INSERT
-- ở đây KHÔNG ghi schema prefix. Mirror của migrations/V1.0.0__initial.sql
-- (+ V1.1.0__workflow_alignment.sql) - giu 2 noi dong bo khi doi schema.
-- Isolation giữa tenant = schema riêng, KHÔNG dùng cột tenant_id.
-- Workflow n8n trỏ bảng qua placeholder {{TENANT_SCHEMA}}.<bảng>.
-- LUU Y: REFERENCES o day de dang rut gon de qua duoc validator cua install -
-- hanh vi xoa lien doi do tang app/workflow dam bao.

CREATE TABLE IF NOT EXISTS asset_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    depreciation_years INT DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES asset_categories(id),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    purchase_date DATE,
    purchase_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    serial_no VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    book_value_remaining DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES asset_items(id),
    user_id UUID,
    dept_id UUID,
    requester_name VARCHAR(255),
    dept_name VARCHAR(255),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS asset_maintenance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES asset_items(id),
    type VARCHAR(50) NOT NULL DEFAULT 'ROUTINE',
    technician VARCHAR(255),
    cost DECIMAL(15, 2) DEFAULT 0,
    done_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_due DATE,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS asset_depreciation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES asset_items(id),
    month VARCHAR(7) NOT NULL,
    depreciation_amount DECIMAL(15, 2) NOT NULL,
    book_value_remaining DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(asset_id, month)
);

CREATE TABLE IF NOT EXISTS asset_disposal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES asset_items(id),
    requester_id UUID,
    requester_name VARCHAR(255),
    reason TEXT NOT NULL,
    estimated_value DECIMAL(15, 2) DEFAULT 0,
    approved_by UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Đề xuất cấp phát (workflow wf_asset_request ghi vào đây trước khi auto-gán).
CREATE TABLE IF NOT EXISTS asset_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES asset_items(id),
    asset_type VARCHAR(100),
    requester_name VARCHAR(255),
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'P3',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    assigned_asset_id UUID REFERENCES asset_items(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Snapshot kiểm kê hàng tháng (workflow wf_asset_inventory_check).
CREATE TABLE IF NOT EXISTS asset_inventory_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    total_assets INT NOT NULL DEFAULT 0,
    by_status JSONB NOT NULL DEFAULT '{}',
    check_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO asset_categories (id, code, name, description, depreciation_years) VALUES
    ('11111111-1111-1111-1111-111111111111', 'IT-HW', 'Thiết bị CNTT', 'Máy tính, máy in, server', 3),
    ('22222222-2222-2222-2222-222222222222', 'OFFICE-FURNITURE', 'Nội thất Văn phòng', 'Bàn, ghế, tủ tài liệu', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO asset_items (id, category_id, code, name, purchase_date, purchase_price, serial_no, status, book_value_remaining) VALUES
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'LAP-001', 'Laptop Dell XPS 15', '2026-01-01', 35000000, 'SN123456', 'AVAILABLE', 35000000)
ON CONFLICT (id) DO NOTHING;
