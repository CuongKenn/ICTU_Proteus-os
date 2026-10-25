# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Infrastructure Layer — Application Settings
# Dùng Pydantic BaseSettings để đọc biến môi trường với type-safety.
# KHÔNG import file này từ Core Domain — chỉ infrastructure và adapters được dùng.

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ─── Server ───────────────────────────────────────────────
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    LOG_LEVEL: str = "INFO"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    # ─── Database ─────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://proteus:proteus@localhost:5432/proteus"

    # ─── Redis (Event Bus) ────────────────────────────────────
    REDIS_URL: str = "redis://:password@localhost:6379"

    # ─── Keycloak (SSO) ───────────────────────────────────────
    KEYCLOAK_URL: str = "http://localhost:8080"
    # Public base URL của Keycloak (qua Traefik, VD: https://auth.proteus.local).
    # Keycloak dùng KC_HOSTNAME làm `iss` trong JWT, trong khi backend gọi
    # Keycloak qua URL nội bộ → cần allowlist cả 2 issuer, nếu không mọi
    # token đều rớt verify_iss (401) ở production.
    KEYCLOAK_PUBLIC_URL: str = ""
    KEYCLOAK_REALM: str = "proteus"
    KEYCLOAK_CLIENT_ID: str = "proteus-bff"
    KEYCLOAK_ADMIN_CLIENT_ID: str = "admin-cli"
    KEYCLOAK_ADMIN_CLIENT_SECRET: str = ""
    KEYCLOAK_ADMIN_USER: str = "admin"
    KEYCLOAK_ADMIN_PASSWORD: str = ""
    KEYCLOAK_CLIENT_SECRET: str = ""
    KEYCLOAK_WEBHOOK_SECRET: str = ""

    # ─── n8n (Workflow Engine) ────────────────────────────────
    N8N_URL: str = "http://n8n:5678"
    N8N_API_KEY: str = ""

    # Plugins Directory
    PLUGINS_DIR: str = "/plugins"  # Container path
    # Base URL public của Plugin Micro-Frontend gateway (dùng dựng external_url
    # cho plugin, tránh hardcode domain local trong manifest.yaml).
    PLUGINS_MFE_URL: str = "http://plugins.proteus.local"

    # ─── Metabase (Analytics) ───────────────────────────────
    METABASE_INTERNAL_URL: str | None = None
    METABASE_SITE_URL: str = "http://localhost:3000"
    METABASE_SECRET_KEY: str = ""
    METABASE_EMBEDDING_KEY: str | None = None

    # ─── Appsmith (Low-code UI) ───────────────────────────────
    APPSMITH_URL: str = "http://localhost:8085"
    APPSMITH_API_KEY: str = ""

    # ─── Qdrant (Vector DB) ───────────────────────────────────
    QDRANT_URL: str = "http://localhost:6333"
    # Model embedding đa ngữ (có tiếng Việt) được fastembed hỗ trợ.
    # e5-small KHÔNG có trong bản fastembed hiện tại → dùng mpnet-multilingual.
    # Đổi model sau khi đã có data đòi recreate collection (khác vector dims).
    QDRANT_DENSE_MODEL: str = (
        "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
    )

    # ─── Mattermost (ChatOps) ─────────────────────────────────
    MATTERMOST_URL: str = "http://mattermost:8065"
    MATTERMOST_BOT_TOKEN: str = ""
    MATTERMOST_WEBHOOK_SECRET: str = ""
    MATTERMOST_SYSTEM_CHANNEL_ID: str = ""

    # ─── Outline (Knowledge Base) ──────────────────────────────────
    OUTLINE_URL: str = "http://localhost:3000"
    # URL public (qua Traefik) — dùng dựng source_url cho citation để
    # browser mở được; nếu rỗng fallback về OUTLINE_URL (nội bộ).
    OUTLINE_PUBLIC_URL: str = ""
    OUTLINE_API_KEY: str = ""
    # Đồng bộ tri thức từ nguồn ngoài (connector framework) — tùy chọn.
    # KNOWLEDGE_SYNC_CONNECTOR: tên connector (VD "http_feed"); rỗng = tắt.
    KNOWLEDGE_SYNC_CONNECTOR: str = ""
    KNOWLEDGE_SYNC_URL: str = ""
    KNOWLEDGE_SYNC_COLLECTION_ID: str = ""
    # ─── LLM Provider ─────────────────────────────────────────
    LLM_PROVIDER: Literal["local_llm"] = "local_llm"
    LLM_BASE_URL: str = "http://localhost:11434/v1"
    LLM_MODEL_NAME: str = "llama3"
    LLM_API_KEY: str = "dummy"

    @property
    def keycloak_jwks_url(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"

    @property
    def keycloak_token_url(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/token"

    @property
    def outline_public_base(self) -> str:
        """Base URL dùng cho link citation hiển thị cho browser."""
        return (self.OUTLINE_PUBLIC_URL or self.OUTLINE_URL).rstrip("/")

    @property
    def outline_base(self) -> str:
        """Base URL dùng cho API call nội bộ (container-to-container)."""
        return self.OUTLINE_URL.rstrip("/")

    @property
    def keycloak_allowed_issuers(self) -> list[str]:
        """Các `iss` hợp lệ: URL nội bộ + public (nếu có)."""
        issuers = [f"{self.KEYCLOAK_URL.rstrip('/')}/realms/{self.KEYCLOAK_REALM}"]
        public_base = (self.KEYCLOAK_PUBLIC_URL or "").strip().rstrip("/")
        if public_base:
            public_iss = f"{public_base}/realms/{self.KEYCLOAK_REALM}"
            if public_iss not in issuers:
                issuers.append(public_iss)
        return issuers


# Singleton instance — import này từ mọi nơi cần dùng config
settings = Settings()
