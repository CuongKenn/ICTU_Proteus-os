-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Meeting Module — Database Seed

INSERT INTO meeting_rooms (id, name, capacity, floor, amenities_json) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Phòng Họp Lớn A1', 50, 'Tầng 1', '{"projector": true, "whiteboard": true, "video_conf": true}'),
    ('22222222-2222-2222-2222-222222222222', 'Phòng Họp Nhỏ B2', 10, 'Tầng 2', '{"projector": false, "whiteboard": true, "video_conf": false}')
ON CONFLICT (id) DO NOTHING;
