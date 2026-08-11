-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Migration: V1.0.0__initial
-- Description: Khởi tạo bảng cho IT Helpdesk Plugin.

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
    category_id UUID NOT NULL REFERENCES it_categories(id) ON DELETE RESTRICT,
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
    ticket_id UUID NOT NULL REFERENCES it_tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Link to hr_employees
    message TEXT NOT NULL,
    new_status VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS it_knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content_md TEXT NOT NULL,
    category_id UUID REFERENCES it_categories(id) ON DELETE SET NULL,
    author_id UUID NOT NULL, -- Link to hr_employees
    view_count INT DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_tickets_status ON it_tickets(status);
CREATE INDEX IF NOT EXISTS idx_it_tickets_assignee ON it_tickets(assignee_id);
CREATE INDEX IF NOT EXISTS idx_it_tickets_sla ON it_tickets(sla_deadline, escalated) WHERE status NOT IN ('RESOLVED', 'CLOSED');
CREATE INDEX IF NOT EXISTS idx_it_knowledge_base_category ON it_knowledge_base(category_id);
