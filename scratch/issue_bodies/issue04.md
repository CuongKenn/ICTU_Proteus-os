## Mô tả vấn đề

File `core/domain/ports.py` hiện chỉ khai báo 2 Abstract Port:
- `AbstractDocumentSourcePort` (cho Outline)
- `AbstractVectorDBPort` (cho Qdrant)

Nhưng dự án sử dụng 7+ external services (n8n, Metabase, Appsmith, Keycloak, Mattermost, Redis Event Bus, Outline, Qdrant). Các service còn lại không có Abstract Port, khiến toàn bộ Use Cases phụ thuộc trực tiếp vào concrete adapter — vi phạm Dependency Inversion Principle.

## Đề xuất sửa

Tạo thêm các Abstract Port trong `ports.py` hoặc tách file:

```python
class AbstractWorkflowEnginePort(ABC):
    @abstractmethod
    async def import_workflow(self, workflow_json: dict) -> str: ...
    @abstractmethod
    async def delete_workflow(self, workflow_id: str) -> None: ...
    @abstractmethod
    async def trigger_webhook(self, url: str, payload: dict) -> dict: ...

class AbstractIdentityProviderPort(ABC):
    @abstractmethod
    async def create_role(self, realm: str, role_name: str) -> None: ...
    @abstractmethod
    async def delete_role(self, realm: str, role_name: str) -> None: ...

class AbstractChatOpsPort(ABC):
    @abstractmethod
    async def send_message(self, channel_id: str, text: str) -> dict: ...
    
class AbstractEventBusPort(ABC):
    @abstractmethod
    async def publish(self, event_type: str, ...) -> None: ...
```

## Phân loại
- **Loại:** Architecture
- **Ưu tiên:** High
