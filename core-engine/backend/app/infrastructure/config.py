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
    KEYCLOAK_REALM: str = "proteus"
    KEYCLOAK_CLIENT_ID: str = "proteus-bff"
    # Issuer public mà Keycloak dùng để ký `iss` trong JWT (VD:
    # https://auth.nttspace.online/realms/proteus do KC_HOSTNAME).
    # Khác với KEYCLOAK_URL nội bộ (http://keycloak:8080) dùng để fetch
    # JWKS/token/Admin API. Nếu để trống → chỉ chấp nhận internal issuer.
    KEYCLOAK_ISSUER: str | None = None
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
    OUTLINE_API_KEY: str = ""
    # ─── LLM Provider ─────────────────────────────────────────
    LLM_PROVIDER: Literal["local_llm"] = "local_llm"
    LLM_BASE_URL: str = "http://localhost:11434/v1"
    LLM_MODEL_NAME: str = "llama3"
    LLM_API_KEY: str = "dummy"

    @property
    def keycloak_jwks_url(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"

    @property
    def keycloak_expected_issuers(self) -> list[str]:
        """Danh sách `iss` hợp lệ khi verify JWT.

        Keycloak phát hành `iss` theo `KC_HOSTNAME` (public URL), trong khi
        backend fetch JWKS qua `KEYCLOAK_URL` nội bộ — hai giá trị này thường
        khác nhau ở production. Chấp nhận cả hai để tránh 401 hàng loạt.
        """
        internal = f"{self.KEYCLOAK_URL.rstrip('/')}/realms/{self.KEYCLOAK_REALM}"
        issuers = [internal]
        if isinstance(self.KEYCLOAK_ISSUER, str) and self.KEYCLOAK_ISSUER.strip():
            public = self.KEYCLOAK_ISSUER.strip().rstrip("/")
            if public not in issuers:
                issuers.append(public)
        return issuers

    @property
    def keycloak_token_url(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/token"


# Singleton instance — import này từ mọi nơi cần dùng config
settings = Settings()
