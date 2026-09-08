# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging
import os
import re
import uuid
from datetime import UTC, datetime
from typing import Any

from packaging.version import InvalidVersion, parse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.external.local_manifest_parser import LocalManifestParser
from app.adapters.repositories.base import AbstractPluginRepository
from app.core.domain.entities import PluginStatus, TenantContext
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class PluginUpgradeError(Exception):
    pass


class PluginUpgradeUseCase:
    """
    Quản lý luồng nâng cấp Plugin (chạy migration scripts).
    """

    def __init__(
        self,
        plugin_repo: AbstractPluginRepository,
        manifest_parser: LocalManifestParser,
        session: AsyncSession,
    ) -> None:
        self.plugin_repo = plugin_repo
        self.manifest_parser = manifest_parser
        self.session = session

    async def upgrade_plugin(
        self, context: TenantContext, plugin_id: uuid.UUID
    ) -> None:
        logger.info(
            "Upgrading plugin",
            extra={"tenant_id": context.tenant_id, "plugin_id": plugin_id},
        )
        plugin = await self.plugin_repo.get_by_id(plugin_id)
        if not plugin:
            raise PluginUpgradeError("Plugin không tồn tại.")

        status = await self.plugin_repo.get_installation_status(
            context.tenant_id, plugin_id
        )
        if status not in (PluginStatus.ACTIVE, PluginStatus.DISABLED):
            raise PluginUpgradeError(
                f"Không thể nâng cấp Plugin ở trạng thái {status}."
            )

        installed_version = await self.plugin_repo.get_installed_version(
            context.tenant_id, plugin_id
        )
        if not installed_version:
            raise PluginUpgradeError(
                "Không xác định được phiên bản đang cài đặt để nâng cấp."
            )

        manifest = self.manifest_parser.parse(plugin.code_name)
        new_version = manifest.version

        try:
            parsed_installed = parse(installed_version)
            parsed_new = parse(new_version)
        except InvalidVersion as e:
            raise PluginUpgradeError(
                f"Định dạng phiên bản không hợp lệ: installed={installed_version}, "
                f"new={new_version}"
            ) from e

        if parsed_new <= parsed_installed:
            raise PluginUpgradeError(
                f"Phiên bản mới ({new_version}) phải lớn hơn phiên bản hiện tại "
                f"({installed_version})."
            )

        # Tim va chay file migration
        migrations_dir = os.path.join(
            settings.PLUGINS_DIR, plugin.code_name, "migrations"
        )
        if not os.path.exists(migrations_dir):
            raise PluginUpgradeError(
                f"Thư mục migrations không tồn tại: {migrations_dir}"
            )

        sql_files = [f for f in os.listdir(migrations_dir) if f.endswith(".sql")]
        migrations_to_run: list[tuple[Any, str, str]] = []

        migration_regex = re.compile(r"^V(\d+\.\d+\.\d+)__.+\.sql$")
        for f in sql_files:
            match = migration_regex.match(f)
            if not match:
                continue
            v_str = match.group(1)
            try:
                v_parsed = parse(v_str)
                if parsed_installed < v_parsed <= parsed_new:
                    file_path = os.path.join(migrations_dir, f)
                    migrations_to_run.append((v_parsed, file_path, f))
            except InvalidVersion:
                continue

        # Sort by version ascending
        migrations_to_run.sort(key=lambda x: x[0])

        if not migrations_to_run:
            logger.info("Không có file migration nào cần chạy.")
            await self.plugin_repo.update_status(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                status=PluginStatus.ACTIVE,
            )
            # update installed_version
            await self.plugin_repo.upsert_installation(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                status=PluginStatus.ACTIVE,
                installed_version=new_version,
            )
            await self.session.commit()
            return

        for _, file_path, f in migrations_to_run:
            with open(file_path, encoding="utf-8-sig") as file:
                sql_content = file.read()
                upper_sql = sql_content.upper()
                if "DROP TABLE" in upper_sql or "DROP COLUMN" in upper_sql:
                    raise PluginUpgradeError(
                        f"Migration file {file_path} chứa lệnh DROP không được phép."
                    )
                if "DELETE FROM" in upper_sql and "WHERE TENANT_ID" not in upper_sql:
                    raise PluginUpgradeError(
                        f"Migration file {file_path} chứa lệnh DELETE FROM không an toàn (thiếu WHERE tenant_id)."
                    )

        # Thuc thi Migration voi RLS
        try:
            schema_name = f"tenant_{context.tenant_id}".replace("-", "_")
            if not re.match(r"^[a-zA-Z0-9_]+$", schema_name):
                raise PluginUpgradeError("Invalid schema name.")
            await self.session.execute(
                text(f'SET LOCAL search_path TO "{schema_name}"')
            )
            await self.session.execute(
                text("SELECT set_config('role', 'tenant_admin', true)")
            )
            await self.session.execute(
                text("SELECT set_config('app.current_tenant_id', :tid, true)"),
                {"tid": str(context.tenant_id)},
            )
            steps_log = []
            for _, file_path, f in migrations_to_run:
                with open(file_path, encoding="utf-8-sig") as file:
                    sql_content = file.read()
                    await self.session.execute(text(sql_content))

                steps_log.append(
                    {
                        "step": f"migration_{f}",
                        "status": "DONE",
                        "at": datetime.now(UTC).isoformat(),
                        "message": f"Chạy thành công script {f}",
                    }
                )

            await self.plugin_repo.update_install_steps_log(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                steps_log=steps_log,
            )

            await self.plugin_repo.upsert_installation(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                status=PluginStatus.ACTIVE,
                installed_version=new_version,
            )
            await self.session.commit()

        except Exception as e:
            await self.session.rollback()
            await self.plugin_repo.update_status(
                tenant_id=context.tenant_id,
                plugin_id=plugin_id,
                status=PluginStatus.FAILED_DIRTY,
                error_log=f"Upgrade failed: {str(e)}",
            )
            await self.session.commit()
            raise PluginUpgradeError(f"Lỗi khi chạy migration: {str(e)}") from e
