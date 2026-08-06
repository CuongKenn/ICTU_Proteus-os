# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Domain — Domain Exceptions
# Các exception nghiệp vụ thuần túy — không phụ thuộc FastAPI hay HTTP status code.
# Tầng Entrypoint sẽ map chúng sang HTTPException tương ứng.


class ProteusBaseException(Exception):
    """Base exception cho mọi Domain Exception trong Proteus OS."""
    pass


class TenantNotFoundError(ProteusBaseException):
    """Tenant không tồn tại hoặc đã bị xóa."""
    pass


class PluginNotFoundError(ProteusBaseException):
    """Plugin không tồn tại trong Marketplace."""
    pass


class PluginAlreadyInstalledError(ProteusBaseException):
    """Plugin đã được cài đặt và đang ở trạng thái ACTIVE."""
    pass


class PluginInstallationError(ProteusBaseException):
    """Lỗi trong quá trình cài đặt Plugin (Compensating Transaction thất bại)."""
    pass


class InsufficientPermissionsError(ProteusBaseException):
    """User không có quyền thực hiện hành động này."""
    pass


class DSLInvalidActionError(ProteusBaseException):
    """Action không nằm trong whitelist của DX-DSL."""
    pass


class DSLPermissionDeniedError(ProteusBaseException):
    """User không có role cần thiết để thực thi action trong DSL."""
    pass


class DSLPluginNotActiveError(ProteusBaseException):
    """Plugin tương ứng với DSL action chưa được cài đặt hoặc không ở trạng thái ACTIVE."""
    pass


class DSLInvalidParametersError(ProteusBaseException):
    """Parameters của DSL command không hợp lệ theo schema."""
    pass


class AICommandPendingApprovalError(ProteusBaseException):
    """Command cần phê duyệt từ người dùng trước khi thực thi."""
    pass


class PathConflictError(ProteusBaseException):
    """UI App path trong manifest đã bị chiếm bởi Plugin khác."""
    pass
