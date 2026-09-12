-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Migration: V1.1.0__workflow_alignment
-- Description: Đồng bộ schema với seed_data.sql (runtime DDL) để workflow n8n
--   chạy được: linkage webhook (requester_name/dept_name, nullable user_id),
--   bảng asset_requests (đề xuất cấp phát) và asset_inventory_snapshots.
--   Giữ nguyên dữ liệu hiện có; các lệnh đều IF NOT EXISTS / DO khối.

-- 1. asset_assignments: linkage webhook (tên người/phòng nhận khi chưa có UUID nhân sự)
ALTER TABLE IF EXISTS asset_assignments
    ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS asset_assignments
    ADD COLUMN IF NOT EXISTS requester_name VARCHAR(255);
ALTER TABLE IF EXISTS asset_assignments
    ADD COLUMN IF NOT EXISTS dept_name VARCHAR(255);

-- 2. asset_disposal_requests: cho phép đề xuất bằng tên người đề xuất
ALTER TABLE IF EXISTS asset_disposal_requests
    ALTER COLUMN requester_id DROP NOT NULL;
ALTER TABLE IF EXISTS asset_disposal_requests
    ADD COLUMN IF NOT EXISTS requester_name VARCHAR(255);

-- 3. Bảng đề xuất cấp phát (workflow wf_asset_request)
CREATE TABLE IF NOT EXISTS asset_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES asset_items(id) ON DELETE SET NULL,
    asset_type VARCHAR(100),
    requester_name VARCHAR(255),
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'P3',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    assigned_asset_id UUID REFERENCES asset_items(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bảng snapshot kiểm kê (workflow wf_asset_inventory_check)
CREATE TABLE IF NOT EXISTS asset_inventory_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    total_assets INT NOT NULL DEFAULT 0,
    by_status JSONB NOT NULL DEFAULT '{}',
    check_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
