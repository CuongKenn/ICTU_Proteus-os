# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from abc import ABC, abstractmethod
from typing import Any


# ─────────────────────────────────────────────────────────────
# DOCUMENT SOURCE PORT
# ─────────────────────────────────────────────────────────────


class AbstractDocumentSourcePort(ABC):
    """
    Port (Interface) cho nguồn cung cấp tài liệu (ví dụ: Outline, Notion, v.v.).
    Thuộc tầng Core Domain / Use Case, giúp đảm bảo Dependency Inversion Principle.
    """

    @abstractmethod
    async def list_documents(
        self, collection_id: str | None = None, offset: int = 0, limit: int = 100
    ) -> list[dict[str, Any]]:
        """Lấy danh sách documents từ nguồn."""
        pass


# ─────────────────────────────────────────────────────────────
# VECTOR DB PORT
# ─────────────────────────────────────────────────────────────


class AbstractVectorDBPort(ABC):
    """
    Port (Interface) cho cơ sở dữ liệu vector (ví dụ: Qdrant, Pinecone, v.v.).
    Thuộc tầng Core Domain / Use Case, giúp đảm bảo Dependency Inversion Principle.
    """

    @abstractmethod
    async def upsert_vectors(
        self, tenant_id: str, chunks: list[str], metadatas: list[dict[str, Any]]
    ) -> None:
        """Upsert vectors vào database."""
        pass

    @abstractmethod
    async def search(
        self,
        tenant_id: str,
        query: str,
        limit: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Tìm kiếm hybrid (vector + text)."""
        pass


# ─────────────────────────────────────────────────────────────
# WORKFLOW ENGINE PORT (n8n)
# ─────────────────────────────────────────────────────────────


class AbstractWorkflowEnginePort(ABC):
    """Port cho Workflow Engine (n8n). Implement bởi N8nAdapter."""

    @abstractmethod
    async def import_workflow(
        self,
        workflow_json: dict[str, Any],
        tenant_id: str,
        workflow_name: str,
    ) -> str:
        """Import một workflow definition vào n8n. Trả về workflow ID."""
        pass

    @abstractmethod
    async def delete_workflow(self, workflow_id: str) -> None:
        """Xóa một workflow khỏi n8n theo ID."""
        pass

    @abstractmethod
    async def activate_workflow(self, workflow_id: str) -> None:
        """Kích hoạt (activate) một workflow đang inactive."""
        pass

    @abstractmethod
    async def deactivate_workflow(self, workflow_id: str) -> None:
        """Vô hiệu hóa (deactivate) một workflow đang active."""
        pass

    @abstractmethod
    async def create_credential(
        self,
        credential_type: str,
        credential_name: str,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Tạo một n8n Credential.
        Trả về dict chứa 'id' của credential mới tạo.
        """
        pass

    @abstractmethod
    async def delete_credential(self, credential_id: str) -> None:
        """Xóa một n8n Credential theo ID."""
        pass


# ─────────────────────────────────────────────────────────────
# UI BUILDER PORT (Appsmith)
# ─────────────────────────────────────────────────────────────


class AbstractUIBuilderPort(ABC):
    """Port cho UI Builder (Appsmith). Implement bởi AppsmithAdapter."""

    @abstractmethod
    async def import_application(
        self,
        app_json: dict[str, Any],
        tenant_id: str,
        app_name: str,
    ) -> str:
        """Import một Appsmith application. Trả về application ID."""
        pass

    @abstractmethod
    async def delete_application(self, app_id: str) -> None:
        """Xóa một Appsmith application theo ID."""
        pass


# ─────────────────────────────────────────────────────────────
# ANALYTICS PORT (Metabase)
# ─────────────────────────────────────────────────────────────


class AbstractAnalyticsPort(ABC):
    """Port cho Analytics Platform (Metabase). Implement bởi MetabaseAdapter."""

    @abstractmethod
    async def import_dashboard(
        self,
        dashboard_json: dict[str, Any],
        tenant_id: str,
        dashboard_name: str,
    ) -> str:
        """Import một Metabase dashboard. Trả về dashboard ID."""
        pass

    @abstractmethod
    async def delete_dashboard(self, dashboard_id: str) -> None:
        """Xóa một Metabase dashboard theo ID."""
        pass


# ─────────────────────────────────────────────────────────────
# IDENTITY PROVIDER PORT (Keycloak)
# ─────────────────────────────────────────────────────────────


class AbstractIdentityProviderPort(ABC):
    """Port cho Identity Provider (Keycloak). Implement bởi KeycloakAdapter."""

    @abstractmethod
    async def create_role(
        self,
        realm: str,
        role_name: str,
        description: str | None = None,
    ) -> None:
        """Tạo một Keycloak Role trong realm."""
        pass

    @abstractmethod
    async def delete_role(self, realm: str, role_name: str) -> None:
        """Xóa một Keycloak Role khỏi realm."""
        pass

    @abstractmethod
    async def assign_role_to_user(
        self, realm: str, user_id: str, role_name: str
    ) -> None:
        """Gán role cho user trong Keycloak."""
        pass


# ─────────────────────────────────────────────────────────────
# CHATOPS PORT (Mattermost)
# ─────────────────────────────────────────────────────────────


class AbstractChatOpsPort(ABC):
    """Port cho ChatOps (Mattermost). Implement bởi MattermostAdapter."""

    @abstractmethod
    async def send_message(self, channel_id: str, message: str) -> str:
        """
        Gửi tin nhắn vào channel.
        Trả về message_id.
        """
        pass

    @abstractmethod
    async def send_interactive_message(
        self,
        channel_id: str,
        message: str,
        actions: list[dict[str, Any]],
    ) -> str:
        """
        Gửi Interactive Message (với buttons) vào channel.
        Dùng cho Human-in-the-loop approval flow.
        Trả về message_id.
        """
        pass

    @abstractmethod
    async def update_message(
        self, post_id: str, message: str, props: dict[str, Any] | None = None
    ) -> None:
        """Cập nhật một message đã gửi (VD: sau khi được approve/reject)."""
        pass


# ─────────────────────────────────────────────────────────────
# EVENT BUS PORT (Redis / Kafka)
# ─────────────────────────────────────────────────────────────


class AbstractEventBusPort(ABC):
    """Port cho Event Bus (Redis Streams / Kafka). Implement bởi RedisEventBusPublisher."""

    @abstractmethod
    async def publish(
        self,
        event_type: str,
        payload: dict[str, Any],
        source_plugin: str | None = None,
    ) -> None:
        """Publish một event lên Event Bus."""
        pass
