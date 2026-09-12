-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- QUY UOC QUAN TRONG: file nay la runtime DDL - install chay no TRONG schema
-- rieng cua tenant (tenant_<uuid>, search_path da set san) nen moi CREATE/INSERT
-- o day KHONG ghi schema prefix. Mirror cua migrations/V1.0.0__initial.sql.
-- Isolation giua tenant = schema rieng, KHONG dung cot tenant_id.
-- Workflow n8n tro bang qua placeholder {{TENANT_SCHEMA}}.<bang>.
-- LUU Y: REFERENCES o day de dang rut gon de qua duoc validator cua install.

CREATE TABLE IF NOT EXISTS document_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS document_incoming (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    so_van_ban VARCHAR(100) NOT NULL,
    noi_gui VARCHAR(255) NOT NULL,
    ngay_nhan DATE NOT NULL,
    trich_yeu TEXT NOT NULL,
    file_url VARCHAR(1024),
    assignee_id UUID,
    status VARCHAR(50) DEFAULT 'received',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS document_outgoing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    so_van_ban VARCHAR(100),
    loai_vb UUID REFERENCES document_categories(id),
    nguoi_ky UUID,
    ngay_phat_hanh DATE,
    file_url VARCHAR(1024),
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS document_internal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    issuer_id UUID,
    effective_date DATE,
    expiry_date DATE,
    confidentiality VARCHAR(50) DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS document_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'outgoing', 'internal'
    approver_id UUID NOT NULL,
    order_no INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    signed_at TIMESTAMP WITH TIME ZONE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS document_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- 'incoming', 'outgoing', 'internal'
    recipient_dept VARCHAR(100) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP WITH TIME ZONE
);
INSERT INTO document_categories (id, name, description) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Nghị quyết', 'Nghị quyết của Đảng ủy, Hội đồng trường'),
    ('22222222-2222-2222-2222-222222222222', 'Quyết định', 'Quyết định hành chính'),
    ('33333333-3333-3333-3333-333333333333', 'Công văn', 'Công văn trao đổi công việc'),
    ('44444444-4444-4444-4444-444444444444', 'Thông báo', 'Thông báo nội bộ'),
    ('55555555-5555-5555-5555-555555555555', 'Tờ trình', 'Tờ trình xin phê duyệt')
ON CONFLICT (id) DO NOTHING;
