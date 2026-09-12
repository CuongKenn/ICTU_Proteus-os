-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- QUY UOC QUAN TRONG: file nay la runtime DDL - install chay no TRONG schema
-- rieng cua tenant (tenant_<uuid>, search_path da set san) nen moi CREATE/INSERT
-- o day KHONG ghi schema prefix. Mirror cua migrations/V1.0.0__initial.sql.
-- Isolation giua tenant = schema rieng, KHONG dung cot tenant_id.
-- Workflow n8n tro bang qua placeholder {{TENANT_SCHEMA}}.<bang>.
-- LUU Y: REFERENCES o day de dang rut gon de qua duoc validator cua install.

CREATE TABLE IF NOT EXISTS project_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    manager_id UUID, -- Sẽ link đến hr_employees nếu có
    start_date DATE,
    end_date DATE,
    budget DECIMAL(15, 2),
    status VARCHAR(50) NOT NULL DEFAULT 'PLANNING', -- PLANNING, ACTIVE, ON_HOLD, COMPLETED, CANCELLED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS project_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES project_projects(id),
    name VARCHAR(255) NOT NULL,
    due_date DATE,
    completion_pct NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS project_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES project_projects(id),
    milestone_id UUID REFERENCES project_milestones(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    assignee_id UUID, -- Sẽ link đến hr_employees
    due_date DATE,
    priority VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
    status VARCHAR(20) DEFAULT 'TODO', -- TODO, IN_PROGRESS, REVIEW, DONE
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS project_task_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES project_tasks(id),
    user_id UUID NOT NULL, -- Sẽ link đến auth_users hoặc hr_employees
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS project_time_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES project_tasks(id),
    user_id UUID NOT NULL,
    log_date DATE NOT NULL,
    hours NUMERIC(5,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES project_projects(id),
    user_id UUID NOT NULL,
    role_in_project VARCHAR(50) DEFAULT 'MEMBER', -- Tên role nội bộ của dự án
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);
INSERT INTO project_projects (id, code, name, start_date, end_date, budget, status) VALUES
    ('11111111-1111-1111-1111-111111111111', 'PRJ-001', 'Triển khai ERP', '2026-01-01', '2026-12-31', 500000000, 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222222', 'PRJ-002', 'Nâng cấp Hạ tầng Mạng', '2026-06-01', '2026-08-31', 200000000, 'PLANNING')
ON CONFLICT (id) DO NOTHING;
