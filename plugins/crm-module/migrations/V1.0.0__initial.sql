-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Migration: V1.0.0__initial
-- Description: Khởi tạo bảng cho CRM Plugin.

CREATE TABLE IF NOT EXISTS crm_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'B2B', -- B2B, B2C, GOVERNMENT
    industry VARCHAR(100),
    company_size VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, BLACKLISTED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
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
    source VARCHAR(100), -- WEBSITE, REFERRAL, EVENT, COLD_CALL
    estimated_value DECIMAL(15, 2),
    stage VARCHAR(50) NOT NULL DEFAULT 'NEW', -- NEW, CONTACTED, QUALIFIED, LOST, CONVERTED
    assigned_to UUID, -- Link to hr_employees (Sales Rep)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    value DECIMAL(15, 2) NOT NULL,
    probability_pct NUMERIC(5,2) DEFAULT 0,
    expected_close_date DATE,
    stage VARCHAR(50) NOT NULL DEFAULT 'PROSPECTING', -- PROSPECTING, QUALIFICATION, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST
    assigned_to UUID, -- Link to hr_employees (Sales Rep)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES crm_customers(id) ON DELETE CASCADE,
    opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Link to hr_employees
    activity_type VARCHAR(50) NOT NULL, -- CALL, EMAIL, MEETING, NOTE
    notes TEXT,
    activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'P3', -- P1 (Critical), P2 (High), P3 (Normal), P4 (Low)
    status VARCHAR(20) DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED
    sla_deadline TIMESTAMPTZ,
    assignee_id UUID, -- Link to hr_employees (Support Rep)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES crm_tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Sẽ link đến auth_users hoặc hr_employees
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON crm_leads(stage);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage ON crm_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_crm_tickets_status ON crm_tickets(status);
CREATE INDEX IF NOT EXISTS idx_crm_activities_date ON crm_activities(activity_date);
