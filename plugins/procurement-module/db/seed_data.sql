INSERT INTO procurement_vendors (id, name, contact, rating, tax_code) VALUES
    ('11111111-1111-1111-1111-111111111111', 'FPT Information System', 'fpt@fpt.com.vn', 5, '0101234567'),
    ('22222222-2222-2222-2222-222222222222', 'Viettel Solutions', 'contact@viettel.com.vn', 5, '0107654321'),
    ('33333333-3333-3333-3333-333333333333', 'VNPT IT', 'info@vnpt.vn', 4, '0100123456')
ON CONFLICT (id) DO NOTHING;
