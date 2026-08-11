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
            sys.path.insert(0, str(self._plugins_dir))

    def load_plugin(self, plugin_code_name: str) -> bool:
        """
        Nạp hoặc Hot-Reload một plugin cụ thể bằng importlib.
        Nếu plugin có file `main.py` chứa hàm `register_plugin(app: FastAPI)`, nó sẽ được gọi.
        """
        plugin_path = self._plugins_dir / plugin_code_name
        if not plugin_path.exists() or not plugin_path.is_dir():
            logger.warning(f"Plugin directory not found: {plugin_path}")
            return False

        # Kiểm tra xem plugin có code Python không (có main.py không)
        main_py = plugin_path / "main.py"
        if not main_py.exists():
            logger.info(f"Plugin {plugin_code_name} is declarative only. No Python code to load.")
            return True

        module_name = f"{plugin_code_name}.main"
        
        try:
            if module_name in sys.modules:
                logger.info(f"Hot-Reloading Python module for plugin: {plugin_code_name}")
                module = importlib.reload(sys.modules[module_name])
            else:
                logger.info(f"Loading Python module for plugin: {plugin_code_name}")
                module = importlib.import_module(module_name)
                
            # Đăng ký với FastAPI nếu có hàm register_plugin
            if hasattr(module, "register_plugin") and callable(module.register_plugin):
                module.register_plugin(self.app)
                logger.info(f"Successfully registered Python extensions for {plugin_code_name}")
            else:
                logger.debug(f"Plugin {plugin_code_name} has main.py but no register_plugin(app) function.")
                
            return True
            
        except Exception as e:
            logger.error(f"Failed to dynamically load plugin {plugin_code_name}: {e}", exc_info=True)
            return False

    def load_all_plugins(self) -> None:
        """Quét và nạp tất cả các plugin có trong thư mục plugins."""
        if not self._plugins_dir.exists():
            return
            
        for plugin_dir in self._plugins_dir.iterdir():
            if plugin_dir.is_dir() and not plugin_dir.name.startswith("."):
                self.load_plugin(plugin_dir.name)
