-- Copyright (c) 2026 CuongKenn & ICTU Team
-- SPDX-License-Identifier: AGPL-3.0-or-later
--
-- QUY UOC QUAN TRONG: file nay la runtime DDL - install chay no TRONG schema
-- rieng cua tenant (tenant_<uuid>, search_path da set san) nen moi CREATE/INSERT
-- o day KHONG ghi schema prefix. Mirror cua migrations/V1.0.0__initial.sql.
-- Isolation giua tenant = schema rieng, KHONG dung cot tenant_id.
-- Workflow n8n tro bang qua placeholder {{TENANT_SCHEMA}}.<bang>.
-- LUU Y: REFERENCES o day de dang rut gon de qua duoc validator cua install.

CREATE TABLE IF NOT EXISTS procurement_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(255),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    tax_code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS procurement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester UUID NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    estimated_cost DECIMAL(15, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS procurement_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES procurement_vendors(id),
    value DECIMAL(15, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS procurement_purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID REFERENCES procurement_contracts(id),
    items_json JSONB NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    delivery_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS procurement_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID REFERENCES procurement_purchase_orders(id),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    received_by UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO procurement_vendors (id, name, contact, rating, tax_code) VALUES
    ('11111111-1111-1111-1111-111111111111', 'FPT Information System', 'fpt@fpt.com.vn', 5, '0101234567'),
    ('22222222-2222-2222-2222-222222222222', 'Viettel Solutions', 'contact@viettel.com.vn', 5, '0107654321'),
    ('33333333-3333-3333-3333-333333333333', 'VNPT IT', 'info@vnpt.vn', 4, '0100123456')
ON CONFLICT (id) DO NOTHING;
