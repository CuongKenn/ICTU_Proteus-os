-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- CRM Module — Database Seed

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
