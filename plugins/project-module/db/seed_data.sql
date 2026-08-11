-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Project Module — Database Seed

INSERT INTO project_projects (id, code, name, start_date, end_date, budget, status) VALUES
    ('11111111-1111-1111-1111-111111111111', 'PRJ-001', 'Triển khai ERP', '2026-01-01', '2026-12-31', 500000000, 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222222', 'PRJ-002', 'Nâng cấp Hạ tầng Mạng', '2026-06-01', '2026-08-31', 200000000, 'PLANNING')
ON CONFLICT (id) DO NOTHING;
