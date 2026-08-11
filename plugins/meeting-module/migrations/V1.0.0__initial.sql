-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Migration: V1.0.0__initial
-- Description: Khởi tạo bảng cho Meeting Plugin.

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
    room_id UUID NOT NULL REFERENCES meeting_rooms(id) ON DELETE RESTRICT,
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
    booking_id UUID NOT NULL REFERENCES meeting_bookings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- Link to hr_employees
    rsvp_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ACCEPTED, DECLINED, TENTATIVE
    checked_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(booking_id, user_id)
);

CREATE TABLE IF NOT EXISTS meeting_agendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES meeting_bookings(id) ON DELETE CASCADE,
    order_no INT NOT NULL,
    topic VARCHAR(255) NOT NULL,
    presenter_id UUID, -- Link to hr_employees
    duration_min INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_minutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES meeting_bookings(id) ON DELETE CASCADE UNIQUE,
    content_md TEXT NOT NULL,
    recorded_by UUID NOT NULL, -- Link to hr_employees
    finalized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_action_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES meeting_bookings(id) ON DELETE CASCADE,
    task_desc TEXT NOT NULL,
    owner_id UUID NOT NULL, -- Link to hr_employees
    due_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_bookings_room ON meeting_bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_meeting_bookings_start ON meeting_bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_status ON meeting_action_items(status);
CREATE INDEX IF NOT EXISTS idx_meeting_action_items_owner ON meeting_action_items(owner_id);
