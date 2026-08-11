-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Finance Module — Database Seed

INSERT INTO finance_accounts (id, code, name, type) VALUES
    ('11111111-1111-1111-1111-111111111111', '111', 'Tiền mặt', 'ASSET'),
    ('22222222-2222-2222-2222-222222222222', '112', 'Tiền gửi ngân hàng', 'ASSET'),
    ('33333333-3333-3333-3333-333333333333', '331', 'Phải trả người bán', 'LIABILITY'),
    ('44444444-4444-4444-4444-444444444444', '511', 'Doanh thu bán hàng', 'REVENUE'),
    ('55555555-5555-5555-5555-555555555555', '642', 'Chi phí quản lý doanh nghiệp', 'EXPENSE')
ON CONFLICT (id) DO NOTHING;
