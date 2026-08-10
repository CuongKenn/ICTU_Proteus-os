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

    # ─── Database ─────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://proteus:proteus@localhost:5432/proteus"

    # ─── Redis (Event Bus) ────────────────────────────────────
    REDIS_URL: str = "redis://:password@localhost:6379"

    # ─── Keycloak (SSO) ───────────────────────────────────────
    KEYCLOAK_URL: str = "http://localhost:8080"
    KEYCLOAK_REALM: str = "proteus"
    KEYCLOAK_CLIENT_ID: str = "proteus-bff"

    # ─── n8n (Workflow Engine) ────────────────────────────────
    N8N_URL: str = "http://localhost:5678"
    N8N_API_KEY: str = ""

    # ─── Metabase (BI & Reports) ──────────────────────────────
    METABASE_URL: str = "http://localhost:3001"
    METABASE_EMBEDDING_KEY: str = ""

    # ─── Appsmith (Low-code UI) ───────────────────────────────
    APPSMITH_URL: str = "http://localhost:8085"
    APPSMITH_API_KEY: str = ""

    # ─── Qdrant (Vector DB) ───────────────────────────────────
    QDRANT_URL: str = "http://localhost:6333"

    # ─── LLM Provider ─────────────────────────────────────────
    LLM_PROVIDER: Literal["openai", "azure_openai", "local_ollama"] = "openai"
    OPENAI_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    @property
    def keycloak_jwks_url(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/certs"

    @property
    def keycloak_token_url(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.KEYCLOAK_REALM}/protocol/openid-connect/token"


# Singleton instance — import này từ mọi nơi cần dùng config
settings = Settings()
