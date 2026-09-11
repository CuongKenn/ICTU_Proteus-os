-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- QUY UOC QUAN TRONG: file nay la runtime DDL - install chay no TRONG schema
-- rieng cua tenant (tenant_<uuid>, search_path da set san) nen moi CREATE/INSERT
-- o day KHONG ghi schema prefix. Mirror cua migrations/V1.0.0__initial.sql.
-- Isolation giua tenant = schema rieng, KHONG dung cot tenant_id.
-- Workflow n8n tro bang qua placeholder {{TENANT_SCHEMA}}.<bang>.
-- LUU Y: REFERENCES o day de dang rut gon de qua duoc validator cua install.

CREATE TABLE IF NOT EXISTS it_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS it_sla_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    priority VARCHAR(20) NOT NULL UNIQUE, -- P1, P2, P3, P4
    resolve_time_hours INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS it_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL, -- Link to hr_employees
    category_id UUID NOT NULL REFERENCES it_categories(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'P3', -- P1, P2, P3, P4
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, WAITING_ON_USER, RESOLVED, CLOSED
    assignee_id UUID, -- Link to hr_employees (IT Staff)
    sla_deadline TIMESTAMPTZ,
    escalated BOOLEAN NOT NULL DEFAULT FALSE,
    feedback_rating INT,
    feedback_comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS it_ticket_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES it_tickets(id),
    user_id UUID NOT NULL, -- Link to hr_employees
    message TEXT NOT NULL,
    new_status VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS it_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content_md TEXT NOT NULL,
    category_id UUID REFERENCES it_categories(id),
    author_id UUID NOT NULL, -- Link to hr_employees
    view_count INT DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO it_categories (id, name, description) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Phần cứng', 'Sự cố máy tính, máy in, mạng'),
    ('22222222-2222-2222-2222-222222222222', 'Tài khoản & Phân quyền', 'Cấp phát, khóa tài khoản, reset mật khẩu'),
    ('33333333-3333-3333-3333-333333333333', 'Phần mềm', 'Cài đặt phần mềm, lỗi ứng dụng')
ON CONFLICT (id) DO NOTHING;

INSERT INTO it_sla_policies (id, priority, resolve_time_hours) VALUES
    ('44444444-4444-4444-4444-444444444441', 'P1', 1),  -- Critical
    ('44444444-4444-4444-4444-444444444442', 'P2', 4),  -- High
    ('44444444-4444-4444-4444-444444444443', 'P3', 24), -- Normal
    ('44444444-4444-4444-4444-444444444444', 'P4', 72)  -- Low
ON CONFLICT (id) DO NOTHING;
