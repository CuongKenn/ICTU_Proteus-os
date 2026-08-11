-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Asset Module — Database Seed

INSERT INTO asset_categories (id, code, name, description, depreciation_years) VALUES
    ('11111111-1111-1111-1111-111111111111', 'IT-HW', 'Thiết bị CNTT', 'Máy tính, máy in, server', 3),
    ('22222222-2222-2222-2222-222222222222', 'OFFICE-FURNITURE', 'Nội thất Văn phòng', 'Bàn, ghế, tủ tài liệu', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO asset_items (id, category_id, code, name, purchase_date, purchase_price, serial_no, status, book_value_remaining) VALUES
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'LAP-001', 'Laptop Dell XPS 15', '2026-01-01', 35000000, 'SN123456', 'AVAILABLE', 35000000)
ON CONFLICT (id) DO NOTHING;
