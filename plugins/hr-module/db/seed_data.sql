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

CREATE TABLE IF NOT EXISTS hr_job_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES hr_departments(id),
    employment_type VARCHAR(50) NOT NULL DEFAULT 'FULLTIME',
    location VARCHAR(255),
    salary_min DECIMAL(15, 2),
    salary_max DECIMAL(15, 2),
    description TEXT,
    requirements TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posting_id UUID REFERENCES hr_job_postings(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    cv_file_url TEXT,
    source VARCHAR(100),
    cover_note TEXT,
    stage VARCHAR(50) NOT NULL DEFAULT 'NEW',
    score INT,
    screening_notes TEXT,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES hr_applications(id),
    interviewers TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    location VARCHAR(255),
    meeting_link TEXT,
    result VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES hr_applications(id),
    salary_offered DECIMAL(15, 2),
    start_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_applications_stage ON hr_applications(stage);
CREATE INDEX IF NOT EXISTS idx_hr_applications_posting ON hr_applications(posting_id);
CREATE INDEX IF NOT EXISTS idx_hr_interviews_app ON hr_interviews(application_id);

INSERT INTO hr_job_postings (id, title, department_id, employment_type, location, salary_min, salary_max, status, tenant_id) VALUES
    ('aaaaaaaa-0000-4000-8000-000000000001', 'Backend Developer (Python)', '22222222-2222-2222-2222-222222222222', 'FULLTIME', 'Thái Nguyên', 15000000, 25000000, 'OPEN', current_setting('app.current_tenant_id')::uuid),
    ('aaaaaaaa-0000-4000-8000-000000000002', 'Kế toán tổng hợp', '33333333-3333-3333-3333-333333333333', 'FULLTIME', 'Thái Nguyên', 12000000, 18000000, 'OPEN', current_setting('app.current_tenant_id')::uuid)
ON CONFLICT (id) DO NOTHING;

INSERT INTO hr_applications (id, posting_id, full_name, email, phone, source, stage, tenant_id) VALUES
    ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'Phạm Văn E', 'e@example.com', '0911111111', 'WEBSITE', 'NEW', current_setting('app.current_tenant_id')::uuid),
    ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'Hoàng Thị F', 'f@example.com', '0922222222', 'REFERRAL', 'SCREENING', current_setting('app.current_tenant_id')::uuid)
ON CONFLICT (id) DO NOTHING;
