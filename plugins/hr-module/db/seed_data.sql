-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- HR Module — Database Seed
-- Tạo cấu trúc bảng ban đầu cho Plugin hr-module.
--
-- LƯU Ý QUAN TRỌNG:
--   - KHÔNG thêm cột tenant_id ở đây — Plugin Manager tự inject.
--   - Tên bảng PHẢI có prefix hr_ (theo quy tắc plugin-manifest-spec.md §3.2)
--   - Chỉ dùng ADD COLUMN trong migration sau, không DROP TABLE/COLUMN.

-- ─────────────────────────────────────────────────────────────
-- BẢNG: hr_employees — Hồ sơ nhân viên
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_employees (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- tenant_id được Plugin Manager inject sau — không khai báo ở đây
    employee_code       VARCHAR(20)  NOT NULL,   -- Mã nhân viên (VD: NV001)
    full_name           VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    phone               VARCHAR(20),
    department          VARCHAR(100),
    position            VARCHAR(100),
    manager_id          UUID REFERENCES hr_employees(id),  -- Self-reference
    hire_date           DATE NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'active',  -- active | on_leave | resigned
    avatar_url          TEXT,
    keycloak_user_id    UUID,                   -- Sync với Keycloak User (sau khi onboarding)
    annual_leave_balance INTEGER NOT NULL DEFAULT 0,  -- Số ngày phép còn lại trong năm
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ             -- Soft delete
);

COMMENT ON TABLE hr_employees IS 'Hồ sơ nhân viên. tenant_id được Plugin Manager inject tự động khi cài đặt.';
COMMENT ON COLUMN hr_employees.employee_code IS 'Mã nhân viên nội bộ, unique trong phạm vi Tenant.';

-- ─────────────────────────────────────────────────────────────
-- BẢNG: hr_leave_requests — Đơn nghỉ phép
-- ─────────────────────────────────────────────────────────────
CREATE TYPE hr_leave_type AS ENUM (
    'annual',       -- Nghỉ phép năm
    'sick',         -- Nghỉ bệnh
    'personal',     -- Nghỉ việc riêng
    'maternity',    -- Nghỉ thai sản
    'unpaid'        -- Nghỉ không lương
);

CREATE TYPE hr_leave_status AS ENUM (
    'pending',      -- Chờ duyệt
    'approved',     -- Đã duyệt
    'rejected',     -- Từ chối
    'cancelled'     -- Đã hủy bởi nhân viên
);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- tenant_id được Plugin Manager inject sau
    employee_id     UUID NOT NULL REFERENCES hr_employees(id),
    leave_type      hr_leave_type NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    days_count      NUMERIC(4,1) NOT NULL,   -- Số ngày (có thể là 0.5 nếu nghỉ nửa ngày)
    reason          TEXT,
    status          hr_leave_status NOT NULL DEFAULT 'pending',
    reviewed_by     UUID REFERENCES hr_employees(id),
    reviewed_at     TIMESTAMPTZ,
    review_note     TEXT,
    ai_command_id   UUID,                   -- FK → ai_commands.id (nếu AI duyệt)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hr_leave_requests IS 'Đơn nghỉ phép. Một nhân viên có thể có nhiều đơn.';
COMMENT ON COLUMN hr_leave_requests.ai_command_id IS 'Nếu được duyệt bởi AI (sau HITL approval), lưu command_id để trace.';

-- ─────────────────────────────────────────────────────────────
-- BẢNG: hr_attendance_logs — Nhật ký chấm công
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hr_attendance_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- tenant_id được Plugin Manager inject sau
    employee_id     UUID NOT NULL REFERENCES hr_employees(id),
    work_date       DATE NOT NULL,
    check_in_at     TIMESTAMPTZ,
    check_out_at    TIMESTAMPTZ,
    working_minutes INTEGER,                -- Tính toán từ check_in/check_out
    source          VARCHAR(50) DEFAULT 'manual',  -- manual | qr_code | face_id
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hr_attendance_logs IS 'Nhật ký chấm công theo ngày. Mỗi ngày có một bản ghi.';

-- ─────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_employees_code
    ON hr_employees(employee_code)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hr_employees_department
    ON hr_employees(department)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_employee
    ON hr_leave_requests(employee_id);

CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_status
    ON hr_leave_requests(status);

CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee_date
    ON hr_attendance_logs(employee_id, work_date);

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: auto-update updated_at
-- ─────────────────────────────────────────────────────────────
CREATE TRIGGER set_hr_employees_updated_at
    BEFORE UPDATE ON hr_employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_hr_leave_requests_updated_at
    BEFORE UPDATE ON hr_leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
