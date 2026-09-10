-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- HR Module — Database Seed

CREATE TABLE IF NOT EXISTS hr_departments (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr_employees (
    id UUID PRIMARY KEY,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    department_id UUID REFERENCES hr_departments(id),
    position VARCHAR(255),
    hire_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    annual_leave_balance INTEGER DEFAULT 0,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr_leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES hr_employees(id),
    year INTEGER NOT NULL,
    remaining_days INTEGER NOT NULL,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES hr_employees(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING_APPROVAL',
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr_attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES hr_employees(id),
    log_time TIMESTAMP WITH TIME ZONE NOT NULL,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr_payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES hr_employees(id),
    amount DECIMAL NOT NULL,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hr_onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES hr_employees(id),
    task_name VARCHAR(255) NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO hr_departments (id, code, name, tenant_id) VALUES
    ('11111111-1111-1111-1111-111111111111', 'HR', 'Phòng Nhân sự', current_setting('app.current_tenant_id')::uuid),
    ('22222222-2222-2222-2222-222222222222', 'IT', 'Phòng Công nghệ thông tin', current_setting('app.current_tenant_id')::uuid),
    ('33333333-3333-3333-3333-333333333333', 'ACC', 'Phòng Kế toán', current_setting('app.current_tenant_id')::uuid)
ON CONFLICT (id) DO NOTHING;

INSERT INTO hr_employees (id, employee_code, full_name, email, department_id, position, hire_date, status, annual_leave_balance, tenant_id) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NV001', 'Nguyễn Văn A', 'nva@company.com', '11111111-1111-1111-1111-111111111111', 'HR Manager', '2023-01-01', 'active', 12, current_setting('app.current_tenant_id')::uuid),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'NV002', 'Trần Thị B', 'ttb@company.com', '22222222-2222-2222-2222-222222222222', 'Developer', '2023-06-15', 'active', 6, current_setting('app.current_tenant_id')::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO hr_employees (id, employee_code, full_name, email, department_id, position, hire_date, status, annual_leave_balance, tenant_id) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'NV003', 'Nguyễn Văn Trung', 'trung@company.com', '22222222-2222-2222-2222-222222222222', 'Software Engineer', '2023-08-01', 'active', 10, current_setting('app.current_tenant_id')::uuid)
ON CONFLICT (id) DO NOTHING;
