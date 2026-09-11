-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- CRM Module — Database Seed
--
-- QUY ƯỚC QUAN TRỌNG: file này là runtime DDL — install chạy nó TRONG schema
-- riêng của tenant (tenant_<uuid>, search_path đã set sẵn) nên mọi CREATE/INSERT
-- ở đây KHÔNG ghi schema prefix. Mirror của migrations/V1.0.0__initial.sql
-- (+ V1.1.0__workflow_alignment.sql) - giu 2 noi dong bo khi doi schema.
-- Isolation giữa tenant = schema riêng, KHÔNG dùng cột tenant_id.
-- Workflow n8n trỏ bảng qua placeholder {{TENANT_SCHEMA}}.<bảng>.
-- LUU Y: REFERENCES o day de dang rut gon de qua duoc validator cua install -
-- hanh vi xoa lien doi do tang app/workflow dam bao.

CREATE TABLE IF NOT EXISTS crm_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'B2B',
    industry VARCHAR(100),
    company_size VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES crm_customers(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    position VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    source VARCHAR(100),
    estimated_value DECIMAL(15, 2),
    stage VARCHAR(50) NOT NULL DEFAULT 'NEW',
    assigned_to UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES crm_customers(id),
    title VARCHAR(255) NOT NULL,
    value DECIMAL(15, 2) NOT NULL,
    probability_pct NUMERIC(5,2) DEFAULT 0,
    expected_close_date DATE,
    stage VARCHAR(50) NOT NULL DEFAULT 'PROSPECTING',
    assigned_to UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES crm_customers(id),
    opportunity_id UUID REFERENCES crm_opportunities(id),
    user_id UUID NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    notes TEXT,
    activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES crm_customers(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'P3',
    status VARCHAR(20) DEFAULT 'OPEN',
    sla_deadline TIMESTAMPTZ,
    assignee_id UUID,
    assignee_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES crm_tickets(id),
    user_id UUID,
    user_name VARCHAR(255),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Khảo sát hài lòng (workflow customer_satisfaction).
CREATE TABLE IF NOT EXISTS crm_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES crm_customers(id),
    opportunity_id UUID REFERENCES crm_opportunities(id),
    score INT NOT NULL DEFAULT 5,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crm_customers (id, name, type, industry, company_size, status) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Công ty Cổ phần Công nghệ ABC', 'B2B', 'IT', '100-500', 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222222', 'Tập đoàn DEF', 'B2B', 'Finance', '500+', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_contacts (id, customer_id, name, email, phone, position, is_primary) VALUES
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Nguyễn Văn A', 'nguyenvana@abc.com', '0901234567', 'Giám đốc IT', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO crm_leads (id, contact_name, company_name, email, source, estimated_value, stage) VALUES
    ('44444444-4444-4444-4444-444444444444', 'Trần Thị B', 'Công ty TNHH XYZ', 'tranthib@xyz.com', 'WEBSITE', 100000000, 'NEW')
ON CONFLICT (id) DO NOTHING;
