-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- Migration: V1.2.0__ats
-- Description: Tuyển dụng (ATS): tin tuyển dụng, hồ sơ ứng viên,
--   lịch phỏng vấn, offer. Mirror trong db/seed_data.sql (runtime DDL).

CREATE TABLE IF NOT EXISTS hr_job_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES hr_departments(id),
    employment_type VARCHAR(50) NOT NULL DEFAULT 'FULLTIME',
    location VARCHAR(255),
    salary_min DECIMAL(15, 2),
    salary_max DECIMAL(15, 2),
    description TEXT,
    requirements TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posting_id UUID REFERENCES hr_job_postings(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    cv_file_url TEXT,
    source VARCHAR(100),
    cover_note TEXT,
    stage VARCHAR(50) NOT NULL DEFAULT 'NEW',
    score INT,
    screening_notes TEXT,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES hr_applications(id),
    interviewers TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    location VARCHAR(255),
    meeting_link TEXT,
    result VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES hr_applications(id),
    salary_offered DECIMAL(15, 2),
    start_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    tenant_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_applications_stage ON hr_applications(stage);
CREATE INDEX IF NOT EXISTS idx_hr_applications_posting ON hr_applications(posting_id);
CREATE INDEX IF NOT EXISTS idx_hr_interviews_app ON hr_interviews(application_id);
