-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Migration: V1.0.0__initial
-- Description: Khởi tạo bảng cho HR Plugin.
-- Lưu ý: Không dùng `tenant_id` trong script này, Plugin Manager sẽ tự động
-- inject cấu trúc multi-tenant khi thực thi.

CREATE TABLE IF NOT EXISTS hr_departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    manager_id UUID, -- Sẽ add foreign key sau
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_code VARCHAR(20) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    department_id UUID REFERENCES hr_departments(id),
    position VARCHAR(100),
    manager_id UUID REFERENCES hr_employees(id),
    hire_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    avatar_url TEXT,
    keycloak_user_id UUID,
    annual_leave_balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE hr_departments ADD CONSTRAINT fk_hr_departments_manager FOREIGN KEY (manager_id) REFERENCES hr_employees(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS hr_leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    total_days NUMERIC(5,2) NOT NULL DEFAULT 0,
    remaining_days NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, year)
);

CREATE TYPE hr_leave_type AS ENUM (
    'annual',
    'sick',
    'personal',
    'maternity',
    'unpaid'
);

CREATE TYPE hr_leave_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
    leave_type hr_leave_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count NUMERIC(4,1) NOT NULL,
    reason TEXT,
    status hr_leave_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES hr_employees(id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    ai_command_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES hr_employees(id),
    work_date DATE NOT NULL,
    check_in_at TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    working_minutes INTEGER,
    source VARCHAR(50) DEFAULT 'manual',
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_payroll_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES hr_employees(id),
    month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    base_salary DECIMAL(15, 2) NOT NULL,
    allowances DECIMAL(15, 2) DEFAULT 0,
    deductions DECIMAL(15, 2) DEFAULT 0,
    net_salary DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES hr_employees(id),
    task_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_employees_code ON hr_employees(employee_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hr_employees_email ON hr_employees(email);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_employee ON hr_leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_status ON hr_leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee_date ON hr_attendance_logs(employee_id, work_date);
