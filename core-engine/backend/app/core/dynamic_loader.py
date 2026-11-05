# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Core Engine - Dynamic Plugin Loader
# Nạp và Hot-Reload các module Python của Plugin vào FastAPI mà không cần restart.

import importlib
import logging
import sys
from pathlib import Path

from fastapi import FastAPI

from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class DynamicPluginLoader:
    def __init__(self, app: FastAPI):
        self.app = app
        self._plugins_dir = Path(settings.PLUGINS_DIR)

        # Đảm bảo đường dẫn tuyệt đối
        if not self._plugins_dir.is_absolute():
            backend_dir = Path(__file__).parent.parent.parent.parent
            root_dir = backend_dir.parent.parent
            self._plugins_dir = (root_dir / settings.PLUGINS_DIR).resolve()

        # Thêm thư mục plugins vào sys.path để có thể import
        if str(self._plugins_dir) not in sys.path:
            sys.path.append(str(self._plugins_dir))

    def load_plugin(self, plugin_code_name: str) -> bool:
        """
        Nạp hoặc Hot-Reload một plugin cụ thể bằng importlib.
        Nếu plugin có file `main.py` chứa hàm `register_plugin(app: FastAPI)`, nó sẽ được gọi.
        """
        plugin_path = self._plugins_dir / plugin_code_name
        if not plugin_path.exists() or not plugin_path.is_dir():
            logger.warning("Plugin directory not found: %s", plugin_path)
            return False

        # Kiểm tra xem plugin có code Python không (có main.py không)
        main_py = plugin_path / "main.py"
        if not main_py.exists():
            logger.info(
                "Plugin %s is declarative only. No Python code to load.",
                plugin_code_name,
            )
            return True

        # Bảo mật (Issue #689): Chỉ nạp code Python khi plugin đã được review hoặc ký duyệt
        if not self._is_plugin_trusted(plugin_path):
            logger.warning(
                "Plugin %s contains executable Python code but is not verified/reviewed. Skipping dynamic load.",
                plugin_code_name,
            )
            return False

        module_name = f"{plugin_code_name}.main"

        try:
            if module_name in sys.modules:
                logger.info(
                    "Hot-Reloading Python module for plugin: %s", plugin_code_name
                )
                module = importlib.reload(sys.modules[module_name])
            else:
                logger.info("Loading Python module for plugin: %s", plugin_code_name)
                module = importlib.import_module(module_name)

            # Đăng ký với FastAPI nếu có hàm register_plugin
            if hasattr(module, "register_plugin") and callable(module.register_plugin):
                module.register_plugin(self.app)
                logger.info(
                    "Successfully registered Python extensions for %s", plugin_code_name
                )
            else:
                logger.debug(
                    "Plugin %s has main.py but no register_plugin(app) function.",
                    plugin_code_name,
                )

            return True

        except Exception as e:
            logger.error(
                "Failed to dynamically load plugin %s: %s",
                plugin_code_name,
                e,
                exc_info=True,
            )
            return False

    def load_all_plugins(self) -> None:
        """Quét và nạp tất cả các plugin có trong thư mục plugins."""
        if not self._plugins_dir.exists():
            return

        for plugin_dir in self._plugins_dir.iterdir():
            if plugin_dir.is_dir() and not plugin_dir.name.startswith("."):
                self.load_plugin(plugin_dir.name)

    def _is_plugin_trusted(self, plugin_path: Path) -> bool:
        """
        Kiểm tra xem plugin có đủ điều kiện an toàn để nạp code Python (main.py) hay không.
        - Chấp nhận nếu có file ký số: `.signature` hoặc `signature.sig`.
        - Chấp nhận nếu manifest khai báo `is_official: true` hoặc `reviewed: true`.
        - Từ chối nếu manifest có `synthesized: true` mà chưa `reviewed: true`, hoặc `reviewed: false`.
        """
        if (plugin_path / ".signature").exists() or (
            plugin_path / "signature.sig"
        ).exists():
            return True

        manifest_file = plugin_path / "manifest.yaml"
        if not manifest_file.exists():
            manifest_file = plugin_path / "manifest.yml"

        if manifest_file.exists():
            try:
                import yaml

                with open(manifest_file, "r", encoding="utf-8") as f:
                    manifest = yaml.safe_load(f) or {}

                if manifest.get("synthesized") is True and not manifest.get("reviewed"):
                    return False

                if manifest.get("reviewed") is False:
                    return False

                if (
                    manifest.get("is_official") is True
                    or manifest.get("reviewed") is True
                ):
                    return True
            except Exception as e:
                logger.warning(
                    "Error checking plugin trust for %s: %s", plugin_path.name, e
                )
                return False

        # Mặc định từ chối nạp code Python nếu không có bằng chứng đã review/ký duyệt
        return False
