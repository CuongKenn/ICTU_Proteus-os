-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Migration: V1.1.0__workflow_alignment
-- Description: Đồng bộ schema với seed_data.sql (runtime DDL) để workflow n8n
--   chạy được: tên người gán/bình luận (chưa resolve UUID nhân sự),
--   bảng crm_surveys (khảo sát hài lòng).

-- 1. crm_tickets: tên người được gán (song song assignee_id UUID)
ALTER TABLE IF EXISTS crm_tickets
    ADD COLUMN IF NOT EXISTS assignee_name VARCHAR(255);

-- 2. crm_ticket_comments: cho phép bình luận bằng tên hiển thị
ALTER TABLE IF EXISTS crm_ticket_comments
    ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE IF EXISTS crm_ticket_comments
    ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);

-- 3. Bảng khảo sát hài lòng (workflow customer_satisfaction)
CREATE TABLE IF NOT EXISTS crm_surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES crm_opportunities(id) ON DELETE SET NULL,
    score INT NOT NULL DEFAULT 5,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
