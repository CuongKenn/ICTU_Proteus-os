-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later

-- Add emergency_contact column to hr_employees table
ALTER TABLE hr_employees ADD COLUMN emergency_contact VARCHAR(255);
