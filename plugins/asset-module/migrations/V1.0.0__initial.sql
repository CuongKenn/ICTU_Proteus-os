-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Migration: V1.0.0__initial
-- Description: Khởi tạo bảng cho Asset Plugin.

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
    category_id UUID NOT NULL REFERENCES asset_categories(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    purchase_date DATE,
    purchase_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    serial_no VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, ASSIGNED, MAINTENANCE, DISPOSED, LOST
    book_value_remaining DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES asset_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Link to hr_employees
    dept_id UUID, -- Link to hr_departments
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    returned_at TIMESTAMPTZ,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS asset_maintenance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES asset_items(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'ROUTINE', -- ROUTINE, REPAIR
    technician VARCHAR(255),
    cost DECIMAL(15, 2) DEFAULT 0,
    done_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_due DATE,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS asset_depreciation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES asset_items(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- YYYY-MM
    depreciation_amount DECIMAL(15, 2) NOT NULL,
    book_value_remaining DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(asset_id, month)
);

CREATE TABLE IF NOT EXISTS asset_disposal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES asset_items(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL, -- Link to hr_employees
    reason TEXT NOT NULL,
    estimated_value DECIMAL(15, 2) DEFAULT 0,
    approved_by UUID, -- Link to hr_employees
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stored Procedure: calculate_depreciation_batch
-- Description: Tính khấu hao hàng tháng cho tất cả tài sản đang có book_value_remaining > 0
CREATE OR REPLACE PROCEDURE calculate_depreciation_batch(target_month VARCHAR(7))
LANGUAGE plpgsql
AS $$
DECLARE
    asset_rec RECORD;
    dep_amount DECIMAL(15, 2);
    new_book_value DECIMAL(15, 2);
BEGIN
    FOR asset_rec IN
        SELECT a.id, a.purchase_price, a.book_value_remaining, c.depreciation_years
        FROM asset_items a
        JOIN asset_categories c ON a.category_id = c.id
        WHERE a.status NOT IN ('DISPOSED', 'LOST') AND a.book_value_remaining > 0
    LOOP
        -- Calculate straight-line depreciation per month
        dep_amount := asset_rec.purchase_price / (asset_rec.depreciation_years * 12);
        
        IF asset_rec.book_value_remaining - dep_amount < 0 THEN
            dep_amount := asset_rec.book_value_remaining;
        END IF;
        
        new_book_value := asset_rec.book_value_remaining - dep_amount;
        
        -- Insert depreciation record
        INSERT INTO asset_depreciation (asset_id, month, depreciation_amount, book_value_remaining)
        VALUES (asset_rec.id, target_month, dep_amount, new_book_value)
        ON CONFLICT DO NOTHING;
        
        -- Update asset item
        UPDATE asset_items
        SET book_value_remaining = new_book_value,
            updated_at = NOW()
        WHERE id = asset_rec.id;
    END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_asset_items_category ON asset_items(category_id);
CREATE INDEX IF NOT EXISTS idx_asset_items_status ON asset_items(status);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_user ON asset_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignments_active ON asset_assignments(asset_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_next_due ON asset_maintenance_logs(next_due);
