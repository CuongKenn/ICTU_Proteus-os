-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- IT Helpdesk Module — Database Seed

INSERT INTO it_categories (id, name, description) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Phần cứng', 'Sự cố máy tính, máy in, mạng'),
    ('22222222-2222-2222-2222-222222222222', 'Tài khoản & Phân quyền', 'Cấp phát, khóa tài khoản, reset mật khẩu'),
    ('33333333-3333-3333-3333-333333333333', 'Phần mềm', 'Cài đặt phần mềm, lỗi ứng dụng')
ON CONFLICT (id) DO NOTHING;

INSERT INTO it_sla_policies (id, priority, resolve_time_hours) VALUES
    ('44444444-4444-4444-4444-444444444441', 'P1', 1),  -- Critical
    ('44444444-4444-4444-4444-444444444442', 'P2', 4),  -- High
    ('44444444-4444-4444-4444-444444444443', 'P3', 24), -- Normal
    ('44444444-4444-4444-4444-444444444444', 'P4', 72)  -- Low
ON CONFLICT (id) DO NOTHING;
