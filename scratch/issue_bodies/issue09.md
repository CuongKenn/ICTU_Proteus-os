## Mô tả vấn đề

Hiện tại test coverage cho các Use Cases quan trọng nhất (Plugin Install, Plugin Uninstall, AI Command) rất thấp hoặc không tồn tại:

- `test_manifest_validator.py` — có 6 test cases (OK)
- `test_user_repo.py` — có 5 test cases (OK)
- **Plugin Install Use Case — KHÔNG CÓ TEST**
- **Plugin Uninstall Use Case — KHÔNG CÓ TEST**
- **AI Command Use Case — KHÔNG CÓ TEST**
- **DSL Validator — KHÔNG CÓ TEST**
- **Tenant Onboarding — KHÔNG CÓ TEST**

CI pipeline đặt `--cov-fail-under=10` — ngưỡng quá thấp.

## Đề xuất sửa

1. Viết unit tests với mocking cho:
   - `PluginInstallUseCase.execute()` — test happy path và 6-step rollback
   - `PluginUninstallUseCase.uninstall_plugin()` — test happy path và error handling
   - `AICommandUseCase.execute()` — test read/write/critical flows
   - `DSLValidator.validate()` — test 5 rules
2. Nâng `--cov-fail-under` lên ít nhất 50%
3. Thêm integration tests cho Saga pattern

## Phân loại
- **Loại:** Quality / Testing
- **Ưu tiên:** Medium
