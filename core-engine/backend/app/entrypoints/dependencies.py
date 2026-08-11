# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Entrypoint — FastAPI Dependency Injection
# Cung cấp các Depends() để inject vào Router handlers.
# Đây là nơi duy nhất ánh xạ HTTP Request → Domain TenantContext.

from __future__ import annotations

import logging
import uuid

from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.appsmith_adapter import AppsmithAdapter
from app.adapters.external.keycloak_adapter import KeycloakAdapter
from app.adapters.external.mattermost_adapter import MattermostAdapter
from app.adapters.external.metabase_adapter import MetabaseAdapter
from app.adapters.external.n8n_adapter import N8nAdapter
from app.adapters.external.outline_adapter import OutlineAdapter
from app.adapters.external.qdrant_adapter import QdrantAdapter
from app.adapters.external.redis_event_bus import RedisEventBusPublisher
from app.adapters.repositories.ai_command_repo import SQLAlchemyAICommandRepository
from app.adapters.repositories.base import (
    AbstractAICommandRepository,
    AbstractDSLDryRunRepository,
    AbstractPluginRepository,
    AbstractTenantRepository,
    AbstractUserRepository,
)
from app.adapters.repositories.dsl_dry_run_repo import SQLAlchemyDSLDryRunRepository
from app.adapters.repositories.plugin_repo import SQLAlchemyPluginRepository
from app.adapters.repositories.role_repo import RoleRepository
from app.adapters.repositories.tenant_repo import SQLAlchemyTenantRepository
from app.adapters.repositories.user_repo import SQLAlchemyUserRepository
from app.core.domain.entities import TenantContext
from app.core.domain.exceptions import InsufficientPermissionsError
from app.core.use_cases.ai_command import AICommandUseCase
from app.core.use_cases.keycloak_webhook import KeycloakWebhookUseCase
from app.core.use_cases.plugin_install import PluginInstallUseCase
from app.core.use_cases.plugin_list import PluginListUseCase
from app.core.use_cases.plugin_toggle import PluginToggleUseCase
from app.core.use_cases.plugin_uninstall import PluginUninstallUseCase
from app.core.use_cases.plugin_upgrade import PluginUpgradeUseCase
from app.core.use_cases.rag_ingestion import RAGIngestionUseCase
from app.core.use_cases.tenant_onboarding import TenantOnboardingUseCase
from app.core.use_cases.user_provisioning import UserProvisioningUseCase
from app.infrastructure.database import get_db_readonly, get_db_transactional

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=True)


async def get_plugin_repo(
    db: AsyncSession = Depends(get_db_readonly),
) -> AbstractPluginRepository:
    """Inject Plugin Repository."""
    return SQLAlchemyPluginRepository(session=db)


async def get_keycloak_adapter(request: Request) -> KeycloakAdapter:
    """Inject KeycloakAdapter."""
    return KeycloakAdapter(client=request.app.state.http_client)


async def get_n8n_adapter(request: Request) -> N8nAdapter:
    """Inject N8nAdapter."""
    return N8nAdapter(client=request.app.state.http_client)


async def get_metabase_adapter(request: Request) -> MetabaseAdapter:
    """Inject MetabaseAdapter."""
    return MetabaseAdapter(client=request.app.state.http_client)


async def get_appsmith_adapter(request: Request) -> AppsmithAdapter:
    """Inject AppsmithAdapter."""
    return AppsmithAdapter(client=request.app.state.http_client)


async def get_redis_event_bus(request: Request) -> RedisEventBusPublisher:
    """Inject RedisEventBusPublisher."""
    return request.app.state.redis_event_bus


async def get_plugin_list_use_case(
    repo: AbstractPluginRepository = Depends(get_plugin_repo),
) -> PluginListUseCase:
    """Inject Plugin List Use Case."""
    return PluginListUseCase(plugin_repo=repo)


async def get_rag_ingestion_use_case(
    request: Request,
) -> RAGIngestionUseCase:
    """Inject RAG Ingestion Use Case."""
    outline_adapter = OutlineAdapter(client=request.app.state.http_client)
    qdrant_adapter = QdrantAdapter(client=request.app.state.http_client)
    return RAGIngestionUseCase(outline_adapter, qdrant_adapter)


async def get_plugin_install_use_case(
    repo: AbstractPluginRepository = Depends(get_plugin_repo),
    n8n_adapter: N8nAdapter = Depends(get_n8n_adapter),
    metabase_adapter: MetabaseAdapter = Depends(get_metabase_adapter),
    appsmith_adapter: AppsmithAdapter = Depends(get_appsmith_adapter),
    keycloak_adapter: KeycloakAdapter = Depends(get_keycloak_adapter),
    db: AsyncSession = Depends(get_db_transactional),
) -> PluginInstallUseCase:
    """Inject Plugin Install Use Case."""
    from app.adapters.external.local_manifest_parser import LocalManifestParser
    from app.adapters.external.mattermost_adapter import MattermostAdapter

    return PluginInstallUseCase(
        plugin_repo=repo,
        manifest_parser=LocalManifestParser(),
        n8n_adapter=n8n_adapter,
        metabase_adapter=metabase_adapter,
        appsmith_adapter=appsmith_adapter,
        keycloak_adapter=keycloak_adapter,
        mattermost_adapter=MattermostAdapter(),
        session=db,
    )


async def get_plugin_uninstall_use_case(
    repo: AbstractPluginRepository = Depends(get_plugin_repo),
    n8n_adapter: N8nAdapter = Depends(get_n8n_adapter),
    metabase_adapter: MetabaseAdapter = Depends(get_metabase_adapter),
    appsmith_adapter: AppsmithAdapter = Depends(get_appsmith_adapter),
    keycloak_adapter: KeycloakAdapter = Depends(get_keycloak_adapter),
    db: AsyncSession = Depends(get_db_transactional),
) -> PluginUninstallUseCase:
    """Inject Plugin Uninstall Use Case."""
    from app.adapters.external.local_manifest_parser import LocalManifestParser
    from app.adapters.external.mattermost_adapter import MattermostAdapter

    return PluginUninstallUseCase(
        plugin_repo=repo,
        manifest_parser=LocalManifestParser(),
        n8n_adapter=n8n_adapter,
        metabase_adapter=metabase_adapter,
        appsmith_adapter=appsmith_adapter,
        keycloak_adapter=keycloak_adapter,
        mattermost_adapter=MattermostAdapter(),
        session=db,
    )


async def get_plugin_toggle_use_case(
    repo: AbstractPluginRepository = Depends(get_plugin_repo),
) -> PluginToggleUseCase:
    """Inject Plugin Toggle Use Case."""
    return PluginToggleUseCase(plugin_repo=repo)


async def get_plugin_upgrade_use_case(
    repo: AbstractPluginRepository = Depends(get_plugin_repo),
    db: AsyncSession = Depends(get_db_transactional),
) -> PluginUpgradeUseCase:
    """Inject Plugin Upgrade Use Case."""
    from app.adapters.external.local_manifest_parser import LocalManifestParser

    return PluginUpgradeUseCase(
        plugin_repo=repo,
        manifest_parser=LocalManifestParser(),
        session=db,
    )


async def get_current_tenant_context(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
    keycloak_adapter: KeycloakAdapter = Depends(get_keycloak_adapter),
) -> TenantContext:
    """
    Extract và validate JWT Token.
    Trả về TenantContext để truyền vào Use Cases.

    Notes:
        - Token được Next.js BFF inject vào
          header "Authorization: Bearer <token>"
        - Browser KHÔNG bao giờ gọi trực tiếp endpoint này
          với token tự mang theo
    """
    # Bước 1: Verify JWT signature
    # (chỉ catch JWTError, không catch HTTPException)
    try:
        payload = await keycloak_adapter.verify_and_decode_token(
            credentials.credentials
        )
    except JWTError as exc:
        logger.warning("Invalid JWT token received", extra={"error": str(exc)})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    # Bước 2: Extract claims — raise 401 nếu thiếu field bắt buộc
    tenant_id_raw = payload.get("tenant_id") or payload.get("azp")
    user_id_raw = payload.get("sub")

    if not tenant_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token thiếu claim tenant_id.",
        )
    if not user_id_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token thiếu claim sub (user_id).",
        )

    # Bước 3: Parse UUID — bắt ValueError nếu format không hợp lệ
    try:
        tenant_id = uuid.UUID(str(tenant_id_raw))
        user_id = uuid.UUID(str(user_id_raw))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token chứa tenant_id hoặc user_id không hợp lệ.",
        ) from exc

    realm_access = payload.get("realm_access", {})
    roles = realm_access.get("roles", [])
    name_claim = payload.get("name")
    pref_username = payload.get("preferred_username")
    full_name = name_claim or pref_username or "Unknown"

    return TenantContext(
        tenant_id=tenant_id,
        user_id=user_id,
        roles=roles,
        email=payload.get("email", ""),
        full_name=full_name,
    )


async def get_user_repo(
    db: AsyncSession = Depends(get_db_readonly),
) -> AbstractUserRepository:
    """Inject User Repository."""
    return SQLAlchemyUserRepository(session=db)


async def get_tenant_repo(
    db: AsyncSession = Depends(get_db_readonly),
) -> AbstractTenantRepository:
    """Inject Tenant Repository."""
    return SQLAlchemyTenantRepository(session=db)


async def get_tenant_onboarding_use_case(
    repo: AbstractTenantRepository = Depends(get_tenant_repo),
    keycloak_adapter: KeycloakAdapter = Depends(get_keycloak_adapter),
    db: AsyncSession = Depends(get_db_readonly),
) -> TenantOnboardingUseCase:
    """Inject Tenant Onboarding Use Case."""
    return TenantOnboardingUseCase(
        tenant_repo=repo, keycloak_adapter=keycloak_adapter, session=db
    )


async def get_user_provisioning_use_case(
    repo: AbstractUserRepository = Depends(get_user_repo),
) -> UserProvisioningUseCase:
    """Inject User Provisioning Use Case."""
    return UserProvisioningUseCase(user_repo=repo)


async def get_mattermost_adapter() -> MattermostAdapter:
    """Inject MattermostAdapter."""
    return MattermostAdapter()


async def get_keycloak_webhook_use_case(
    user_repo: AbstractUserRepository = Depends(get_user_repo),
    mattermost_adapter: MattermostAdapter = Depends(get_mattermost_adapter),
) -> KeycloakWebhookUseCase:
    """Inject KeycloakWebhookUseCase."""
    return KeycloakWebhookUseCase(
        user_repo=user_repo,
        mattermost_adapter=mattermost_adapter,
    )


async def get_role_repo(
    db: AsyncSession = Depends(get_db_readonly),
) -> RoleRepository:
    """Inject Role Repository."""
    return RoleRepository(session=db)


async def get_ai_command_repo(
    db: AsyncSession = Depends(get_db_readonly),
) -> AbstractAICommandRepository:
    """Inject AI Command Repository."""
    return SQLAlchemyAICommandRepository(session=db)


async def get_dsl_dry_run_repo(
    db: AsyncSession = Depends(get_db_readonly),
) -> AbstractDSLDryRunRepository:
    """Inject DSL Dry Run Repository."""
    return SQLAlchemyDSLDryRunRepository(session=db)


async def get_ai_command_use_case(
    plugin_repo: AbstractPluginRepository = Depends(get_plugin_repo),
    ai_command_repo: AbstractAICommandRepository = Depends(get_ai_command_repo),
    dsl_dry_run_repo: AbstractDSLDryRunRepository = Depends(get_dsl_dry_run_repo),
    mattermost_adapter: MattermostAdapter = Depends(get_mattermost_adapter),
    n8n_adapter: N8nAdapter = Depends(get_n8n_adapter),
) -> AICommandUseCase:
    """Inject AICommandUseCase."""
    return AICommandUseCase(
        plugin_repo=plugin_repo,
        ai_command_repo=ai_command_repo,
        dsl_dry_run_repo=dsl_dry_run_repo,
        mattermost_adapter=mattermost_adapter,
        n8n_adapter=n8n_adapter,
    )


def require_permission(permission: str):
    """
    Middleware kiểm tra quyền hạn (RBAC) dựa trên Permission String.
    Bypass kiểm tra nếu user có role 'superadmin' hoặc 'tenant_admin'.
    """

    async def check_permission(
        context: TenantContext = Depends(get_current_tenant_context),
        role_repo: RoleRepository = Depends(get_role_repo),
    ) -> TenantContext:
        if any(r in context.roles for r in ["superadmin", "tenant_admin"]):
            return context

        user_permissions = await role_repo.get_user_permissions(context.user_id)
        if permission not in user_permissions:
            raise InsufficientPermissionsError(
                f"Cần quyền '{permission}' để thực hiện hành động này."
            )
        return context

    return check_permission
