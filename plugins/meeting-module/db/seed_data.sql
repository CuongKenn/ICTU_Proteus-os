-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- QUY UOC QUAN TRONG: file nay la runtime DDL - install chay no TRONG schema
-- rieng cua tenant (tenant_<uuid>, search_path da set san) nen moi CREATE/INSERT
-- o day KHONG ghi schema prefix. Mirror cua migrations/V1.0.0__initial.sql.
-- Isolation giua tenant = schema rieng, KHONG dung cot tenant_id.
-- Workflow n8n tro bang qua placeholder {{TENANT_SCHEMA}}.<bang>.
-- LUU Y: REFERENCES o day de dang rut gon de qua duoc validator cua install.

CREATE TABLE IF NOT EXISTS meeting_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    capacity INT NOT NULL DEFAULT 10,
    floor VARCHAR(50),
    amenities_json JSONB DEFAULT '{}', -- Ví dụ: {"projector": true, "whiteboard": true, "video_conf": false}
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS meeting_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES meeting_rooms(id),
    organizer_id UUID NOT NULL, -- Link to hr_employees
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW
    description TEXT,
    released_at TIMESTAMPTZ, -- Để workflow tự động giải phóng đánh dấu
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS meeting_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES meeting_bookings(id),
    user_id UUID NOT NULL, -- Link to hr_employees
    rsvp_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ACCEPTED, DECLINED, TENTATIVE
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(booking_id, user_id)
);
CREATE TABLE IF NOT EXISTS meeting_agendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES meeting_bookings(id),
    order_no INT NOT NULL,
    topic VARCHAR(255) NOT NULL,
    presenter_id UUID, -- Link to hr_employees
    duration_min INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS meeting_minutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES meeting_bookings(id) UNIQUE,
    content_md TEXT NOT NULL,
    recorded_by UUID NOT NULL, -- Link to hr_employees
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS meeting_action_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES meeting_bookings(id),
    task_desc TEXT NOT NULL,
    owner_id UUID NOT NULL, -- Link to hr_employees
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO meeting_rooms (id, name, capacity, floor, amenities_json) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Phòng Họp Lớn A1', 50, 'Tầng 1', '{"projector": true, "whiteboard": true, "video_conf": true}'),
    ('22222222-2222-2222-2222-222222222222', 'Phòng Họp Nhỏ B2', 10, 'Tầng 2', '{"projector": false, "whiteboard": true, "video_conf": false}')
ON CONFLICT (id) DO NOTHING;
