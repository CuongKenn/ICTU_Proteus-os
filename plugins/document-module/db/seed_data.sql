INSERT INTO document_categories (id, name, description) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Nghị quyết', 'Nghị quyết của Đảng ủy, Hội đồng trường'),
    ('22222222-2222-2222-2222-222222222222', 'Quyết định', 'Quyết định hành chính'),
    ('33333333-3333-3333-3333-333333333333', 'Công văn', 'Công văn trao đổi công việc'),
    ('44444444-4444-4444-4444-444444444444', 'Thông báo', 'Thông báo nội bộ'),
    ('55555555-5555-5555-5555-555555555555', 'Tờ trình', 'Tờ trình xin phê duyệt')
ON CONFLICT (id) DO NOTHING;
