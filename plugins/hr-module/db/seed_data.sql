-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- HR Module — Database Seed

INSERT INTO hr_departments (id, code, name) VALUES
    ('11111111-1111-1111-1111-111111111111', 'HR', 'Phòng Nhân sự'),
    ('22222222-2222-2222-2222-222222222222', 'IT', 'Phòng Công nghệ thông tin'),
    ('33333333-3333-3333-3333-333333333333', 'ACC', 'Phòng Kế toán')
ON CONFLICT (id) DO NOTHING;

INSERT INTO hr_employees (id, employee_code, full_name, email, department_id, position, hire_date, status, annual_leave_balance) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'NV001', 'Nguyễn Văn A', 'nva@company.com', '11111111-1111-1111-1111-111111111111', 'HR Manager', '2023-01-01', 'active', 12),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'NV002', 'Trần Thị B', 'ttb@company.com', '22222222-2222-2222-2222-222222222222', 'Developer', '2023-06-15', 'active', 6)
ON CONFLICT (id) DO NOTHING;
