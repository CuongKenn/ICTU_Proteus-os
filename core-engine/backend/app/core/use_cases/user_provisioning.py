# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from datetime import UTC, datetime

from app.adapters.repositories.base import AbstractUserRepository
from app.core.domain.entities import TenantContext, UserEntity


class UserProvisioningUseCase:
    """
    Use Case: User Provisioning.
    Đồng bộ user profile từ Keycloak JWT (TenantContext) vào PostgreSQL.
    """

    def __init__(self, user_repo: AbstractUserRepository):
        self.user_repo = user_repo

    async def sync_user_profile(self, tenant_context: TenantContext) -> UserEntity:
        """
        Thực hiện First Login Provisioning:
        - Nếu chưa có trong DB: INSERT mới.
        - Nếu có rồi: UPDATE last_login_at, email, full_name.
        - M6: TỪ CHỐI nếu user đã soft-delete (deleted_at NOT NULL);
          KHÔNG auto-reactivate is_active (giữ nguyên trạng thái).
        """
        # M6: fail-closed — kiểm tra deleted trước khi upsert. get_by_keycloak_id
        # thường lọc deleted_at IS NULL nên cần API including-deleted nếu có.
        checker = getattr(
            self.user_repo, "get_by_keycloak_id_including_deleted", None
        )
        if callable(checker):
            raw = await checker(tenant_context.user_id)
            if raw is not None and raw.get("deleted_at") is not None:
                raise PermissionError(
                    "Tài khoản đã bị vô hiệu hóa, không thể đăng nhập."
                )
            if (
                raw is not None
                and not raw.get("is_active")
                and raw.get("last_login_at") is not None
            ):
                # Đã từng login nhưng đang inactive (bị deactivate thủ công
                # mà deleted_at chưa set ở môi trường cũ) → không resurrect.
                raise PermissionError(
                    "Tài khoản đang bị vô hiệu hóa, liên hệ quản trị viên."
                )
            # Pending invite (chưa từng login, is_active=False) → cho phép
            # kích hoạt ở lần login đầu; user thường → giữ nguyên is_active.
            if raw is None:
                user_data = {
                    "tenant_id": tenant_context.tenant_id,
                    "keycloak_id": tenant_context.user_id,
                    "email": tenant_context.email,
                    "full_name": tenant_context.full_name,
                    "last_login_at": datetime.now(UTC),
                    "is_active": True,
                }
            elif not raw.get("is_active") and raw.get("last_login_at") is None:
                user_data = {
                    "tenant_id": tenant_context.tenant_id,
                    "keycloak_id": tenant_context.user_id,
                    "email": tenant_context.email,
                    "full_name": tenant_context.full_name,
                    "last_login_at": datetime.now(UTC),
                    "is_active": True,
                }
            else:
                # M6: không auto-reactivate — bỏ is_active khỏi upsert.
                user_data = {
                    "tenant_id": tenant_context.tenant_id,
                    "keycloak_id": tenant_context.user_id,
                    "email": tenant_context.email,
                    "full_name": tenant_context.full_name,
                    "last_login_at": datetime.now(UTC),
                }
        else:
            # Fallback khi repo không hỗ trợ check deleted: vẫn tránh
            # auto-reactivate bằng cách không ép is_active=True.
            user_data = {
                "tenant_id": tenant_context.tenant_id,
                "keycloak_id": tenant_context.user_id,
                "email": tenant_context.email,
                "full_name": tenant_context.full_name,
                "last_login_at": datetime.now(UTC),
            }

        user_entity = await self.user_repo.upsert(user_data)
        await self.user_repo.commit()

        return user_entity
