# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING

from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import PluginStatus, TenantContext
from app.core.domain.ports import AbstractWorkflowEnginePort

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class PluginToggleError(Exception):
    pass


class PluginToggleUseCase:
    def __init__(
        self,
        plugin_repo: AbstractPluginRepository,
        n8n_adapter: AbstractWorkflowEnginePort | None = None,
        session: AsyncSession | None = None,
    ) -> None:
        self.plugin_repo = plugin_repo
        self.n8n_adapter = n8n_adapter
        self.session = session

    async def disable_plugin(
        self, context: TenantContext, plugin_id: uuid.UUID
    ) -> None:
        """
        Tạm vô hiệu hóa Plugin đang hoạt động: tắt workflows n8n và cập nhật DB.
        """
        logger.info(
            "Disabling plugin",
            extra={"tenant_id": context.tenant_id, "plugin_id": plugin_id},
        )
        plugin = await self.plugin_repo.get_by_id(plugin_id)
        if not plugin:
            raise PluginToggleError("Plugin không tồn tại.")

        status = await self.plugin_repo.get_installation_status(
            context.tenant_id, plugin_id
        )
        if status != PluginStatus.ACTIVE:
            raise PluginToggleError("Plugin không ở trạng thái ACTIVE để vô hiệu hóa.")

        config = await self.plugin_repo.get_config(context.tenant_id, plugin_id)
        workflow_ids = config.get("n8n", []) if isinstance(config, dict) else []
        deactivated_wfs: list[str] = []

        if self.n8n_adapter and workflow_ids:
            try:
                for wf_id in workflow_ids:
                    if hasattr(self.n8n_adapter, "deactivate_workflow"):
                        await self.n8n_adapter.deactivate_workflow(str(wf_id))
                        deactivated_wfs.append(str(wf_id))
            except Exception as e:
                for wf_id in deactivated_wfs:
                    try:
                        await self.n8n_adapter.activate_workflow(wf_id)
                    except Exception:
                        pass
                logger.error("Failed to deactivate n8n workflows: %s", e)
                raise PluginToggleError(f"Không thể tắt workflows n8n: {e}") from e

        try:
            await self.plugin_repo.update_status(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                status=PluginStatus.DISABLED,
            )
            if hasattr(self.plugin_repo, "commit"):
                await self.plugin_repo.commit()
            if self.session:
                await self.session.commit()
        except Exception as e:
            if self.n8n_adapter and deactivated_wfs:
                for wf_id in deactivated_wfs:
                    try:
                        await self.n8n_adapter.activate_workflow(wf_id)
                    except Exception:
                        pass
            logger.error("Failed to update plugin status in DB: %s", e)
            raise PluginToggleError(f"Lỗi cập nhật trạng thái Plugin: {e}") from e

        logger.info(
            "Plugin disabled successfully",
            extra={"tenant_id": context.tenant_id, "plugin_id": plugin_id},
        )

    async def enable_plugin(self, context: TenantContext, plugin_id: uuid.UUID) -> None:
        """
        Bật lại Plugin đã bị vô hiệu hóa: kích hoạt workflows n8n và cập nhật DB.
        """
        logger.info(
            "Enabling plugin",
            extra={"tenant_id": context.tenant_id, "plugin_id": plugin_id},
        )
        plugin = await self.plugin_repo.get_by_id(plugin_id)
        if not plugin:
            raise PluginToggleError("Plugin không tồn tại.")

        status = await self.plugin_repo.get_installation_status(
            context.tenant_id, plugin_id
        )
        if status != PluginStatus.DISABLED:
            raise PluginToggleError("Plugin không ở trạng thái DISABLED để bật lại.")

        config = await self.plugin_repo.get_config(context.tenant_id, plugin_id)
        workflow_ids = config.get("n8n", []) if isinstance(config, dict) else []
        activated_wfs: list[str] = []

        if self.n8n_adapter and workflow_ids:
            try:
                for wf_id in workflow_ids:
                    if hasattr(self.n8n_adapter, "activate_workflow"):
                        await self.n8n_adapter.activate_workflow(str(wf_id))
                        activated_wfs.append(str(wf_id))
            except Exception as e:
                for wf_id in activated_wfs:
                    try:
                        await self.n8n_adapter.deactivate_workflow(wf_id)
                    except Exception:
                        pass
                logger.error("Failed to activate n8n workflows: %s", e)
                raise PluginToggleError(f"Không thể kích hoạt workflows n8n: {e}") from e

        try:
            await self.plugin_repo.update_status(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                status=PluginStatus.ACTIVE,
            )
            if hasattr(self.plugin_repo, "commit"):
                await self.plugin_repo.commit()
            if self.session:
                await self.session.commit()
        except Exception as e:
            if self.n8n_adapter and activated_wfs:
                for wf_id in activated_wfs:
                    try:
                        await self.n8n_adapter.deactivate_workflow(wf_id)
                    except Exception:
                        pass
            logger.error("Failed to update plugin status in DB: %s", e)
            raise PluginToggleError(f"Lỗi cập nhật trạng thái Plugin: {e}") from e

        logger.info(
            "Plugin enabled successfully",
            extra={"tenant_id": context.tenant_id, "plugin_id": plugin_id},
        )
