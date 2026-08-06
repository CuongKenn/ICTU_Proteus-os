## 📋 Mô tả thay đổi

<!-- Tóm tắt ngắn gọn những gì PR này làm -->

Closes #<!-- số Issue -->

---

## 🏷️ Loại thay đổi

- [ ] 🐛 Bug fix (sửa lỗi, không breaking change)
- [ ] ✨ Feature mới (thêm tính năng)
- [ ] 💥 Breaking change (thay đổi làm hỏng tính năng hiện có)
- [ ] 📝 Tài liệu (chỉ thay đổi docs)
- [ ] ♻️ Refactor (không đổi behavior)
- [ ] 🔧 Config / CI/CD

---

## ✅ Checklist trước khi Submit

### Chung
- [ ] Tôi đã đọc [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] Code tuân thủ Hexagonal Architecture (Backend) và BFF Pattern (Frontend)
- [ ] Không có `print()` — dùng `logging` thay thế
- [ ] Mọi file mới có copyright header SPDX AGPL-3.0

### Backend (nếu áp dụng)
- [ ] Mọi bảng DB mới có cột `tenant_id`
- [ ] Cột `deleted_at` cho Core Data (Users, Plugins, Tenants)
- [ ] Pydantic Schema cho tất cả Input/Output (Swagger)
- [ ] Cập nhật `docs/api-swagger.yaml` nếu thêm/sửa endpoint

### Frontend (nếu áp dụng)
- [ ] Không gọi Backend URL trực tiếp — qua `/api/proxy/*` (BFF)
- [ ] Business logic ở Custom Hook, không ở Component
- [ ] Không lưu JWT trong Zustand hay localStorage

### AI / HITL (nếu áp dụng)
- [ ] Action mới đã được thêm vào DSL Whitelist (dsl-spec.md)
- [ ] `effect=write/critical` có xử lý Human-in-the-loop approval

### Tài liệu
- [ ] Cập nhật `CHANGELOG.md`
- [ ] Cập nhật `docs/api-swagger.yaml` (nếu thay đổi API)

---

## 🧪 Cách test

<!-- Mô tả cách reviewer test PR này -->

```bash
# Ví dụ:
docker compose up postgres redis -d
cd core-engine/backend && uvicorn main:app
# Truy cập http://localhost:8000/docs
```

---

## 📸 Screenshots (nếu thay đổi UI)

<!-- Paste ảnh trước/sau ở đây -->
