## Mô tả vấn đề

Dự án tuyên bố sử dụng Hexagonal Architecture (Ports and Adapters), nhưng nhiều Use Cases trong tầng Core Domain import trực tiếp concrete Adapter classes thay vì qua Abstract Port/Interface:

- `plugin_install.py` import trực tiếp `AppsmithAdapter`, `KeycloakAdapter`, `MetabaseAdapter`, `N8nAdapter`, `MattermostAdapter`
- `plugin_uninstall.py` tương tự
- `ai_command.py` import `MattermostAdapter`, `N8nAdapter`
- `tenant_onboarding.py` import `KeycloakAdapter`

Theo Dependency Inversion Principle (DIP), tầng Core không được phụ thuộc vào tầng Adapters.

## Đề xuất sửa

1. Tạo Abstract Port cho mỗi external service trong `core/domain/ports.py`:
   - `AbstractWorkflowEnginePort` (cho n8n)
   - `AbstractUIBuilderPort` (cho Appsmith)
   - `AbstractAnalyticsPort` (cho Metabase)
   - `AbstractIdentityProviderPort` (cho Keycloak)
   - `AbstractChatOpsPort` (cho Mattermost)
2. Use Cases chỉ import và depend on Ports
3. Dependency Injection ở tầng Entrypoints wire concrete adapters vào ports

## Files liên quan
- `core-engine/backend/app/core/use_cases/plugin_install.py`
- `core-engine/backend/app/core/use_cases/plugin_uninstall.py`
- `core-engine/backend/app/core/use_cases/ai_command.py`
- `core-engine/backend/app/core/domain/ports.py` — hiện chỉ có 2 ports

## Phân loại
- **Loại:** Architecture / Refactoring
- **Ưu tiên:** High
