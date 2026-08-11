from fastapi import APIRouter, Depends, status

from app.core.domain.entities import TenantContext
from app.core.use_cases.user_provisioning import UserProvisioningUseCase
from app.entrypoints.dependencies import (
    get_current_tenant_context,
    get_user_provisioning_use_case,
)
from app.entrypoints.schemas.user import UserProfileResponse

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get(
    "/me",
    response_model=UserProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Current User Profile",
    description=(
        "Lấy thông tin User hiện tại (First Login Provisioning). "
        "Nếu là lần đầu tiên, user sẽ được tự động thêm vào PostgreSQL."
    ),
)
async def get_me(
    tenant_context: TenantContext = Depends(get_current_tenant_context),
    use_case: UserProvisioningUseCase = Depends(get_user_provisioning_use_case),
):
    user_entity = await use_case.sync_user_profile(tenant_context)
    return user_entity
