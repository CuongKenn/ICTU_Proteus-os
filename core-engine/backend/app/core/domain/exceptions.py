# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Domain Exceptions
# Các exception nghiệp vụ thuần túy — không phụ thuộc FastAPI hay HTTP status code.
# Tầng Entrypoint sẽ map chúng sang HTTPException tương ứng.


class ProteusBaseException(Exception):
    """
    Base exception cho mọi Domain Exception trong Proteus OS.
    Luôn truyền message rõ ràng để dễ debug trong logs.
    """

    def __init__(self, message: str = "") -> None:
        super().__init__(message)
        self.message = message

    def __str__(self) -> str:
        return self.message or self.__class__.__name__


class TenantNotFoundError(ProteusBaseException):
    """Tenant không tồn tại hoặc đã bị xóa."""


class PluginNotFoundError(ProteusBaseException):
    """Plugin không tồn tại trong Marketplace."""


class PluginAlreadyInstalledError(ProteusBaseException):
    """Plugin đã được cài đặt và đang ở trạng thái ACTIVE."""


class PluginInstallationError(ProteusBaseException):
    """Lỗi trong quá trình cài đặt Plugin (Compensating Transaction thất bại)."""


class InsufficientPermissionsError(ProteusBaseException):
    """User không có quyền thực hiện hành động này."""


class DSLInvalidActionError(ProteusBaseException):
    """Action không nằm trong whitelist của DX-DSL."""


class DSLPermissionDeniedError(ProteusBaseException):
    """User không có role cần thiết để thực thi action trong DSL."""


class DSLPluginNotActiveError(ProteusBaseException):
    """Plugin tương ứng với DSL action chưa được cài đặt hoặc không ở trạng thái ACTIVE."""


class DSLInvalidParametersError(ProteusBaseException):
    """Parameters của DSL command không hợp lệ theo schema."""


class AICommandPendingApprovalError(ProteusBaseException):
    """Command cần phê duyệt từ người dùng trước khi thực thi."""


class PathConflictError(ProteusBaseException):
    """UI App path trong manifest đã bị chiếm bởi Plugin khác."""
