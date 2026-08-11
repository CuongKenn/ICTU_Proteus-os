# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Outbound Adapter — Local Manifest Parser

import logging
from pathlib import Path

import yaml
from pydantic import ValidationError

from app.core.domain.plugin_manifest import PluginManifest
from app.infrastructure.config import settings

logger = logging.getLogger(__name__)


class ManifestParserError(Exception):
    """Lỗi khi đọc hoặc parse manifest."""


class LocalManifestParser:
    """
    Adapter để đọc và parse file manifest.yaml từ ổ đĩa (Local filesystem).
    """

    def __init__(self) -> None:
        # Nếu đang chạy local ngoài docker, thư mục backend là `core-engine/backend`
        # và plugins nằm ở root.
        # Ở môi trường docker, PLUGINS_DIR có thể được map tới `/plugins`.
        self._plugins_dir = Path(settings.PLUGINS_DIR)
        if not self._plugins_dir.is_absolute():
            # Quy đổi tương đối so với thư mục project (root)
            backend_dir = Path(__file__).parent.parent.parent.parent
            root_dir = backend_dir.parent.parent
            self._plugins_dir = (root_dir / settings.PLUGINS_DIR).resolve()

    def parse(self, plugin_code_name: str) -> PluginManifest:
        """
        Đọc file manifest.yaml của plugin và parse thành PluginManifest entity.
        """
        manifest_path = self._plugins_dir / plugin_code_name / "manifest.yaml"
        if not manifest_path.exists():
            raise ManifestParserError(
                f"Không tìm thấy file manifest.yaml cho plugin '{plugin_code_name}' "
                f"tại {manifest_path}"
            )

        try:
            with open(manifest_path, encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except yaml.YAMLError as e:
            raise ManifestParserError(
                f"File manifest.yaml không hợp lệ (YAML Error): {e}"
            )
        except Exception as e:
            raise ManifestParserError(f"Lỗi khi đọc file manifest.yaml: {e}")

        if not data:
            raise ManifestParserError("File manifest.yaml trống.")

        try:
            manifest = PluginManifest(**data)
            return manifest
        except ValidationError as e:
            logger.error("Manifest validation error", extra={"error": e.errors()})
            raise ManifestParserError(f"Lỗi validate schema manifest.yaml: {e}")
