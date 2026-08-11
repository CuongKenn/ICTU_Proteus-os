# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI

from app.core.dynamic_loader import DynamicPluginLoader


@pytest.fixture
def mock_app():
    return FastAPI()


def test_dynamic_loader_init(mock_app):
    loader = DynamicPluginLoader(mock_app)
    assert loader.app == mock_app
    assert loader._plugins_dir is not None


@patch("app.core.dynamic_loader.Path.exists")
@patch("app.core.dynamic_loader.Path.is_dir")
def test_load_plugin_not_found(mock_is_dir, mock_exists, mock_app):
    mock_exists.return_value = False

    loader = DynamicPluginLoader(mock_app)
    result = loader.load_plugin("non-existent-plugin")

    assert result is False


@patch("app.core.dynamic_loader.importlib.import_module")
def test_load_plugin_declarative(mock_import, mock_app, tmp_path):
    loader = DynamicPluginLoader(mock_app)
    loader._plugins_dir = tmp_path

    plugin_dir = tmp_path / "test-plugin"
    plugin_dir.mkdir()

    # Do not create main.py, should be declarative
    result = loader.load_plugin("test-plugin")

    assert result is True
    mock_import.assert_not_called()


@patch("app.core.dynamic_loader.importlib.import_module")
@patch("sys.modules", new_callable=dict)
def test_load_plugin_with_python(mock_modules, mock_import, mock_app, tmp_path):
    loader = DynamicPluginLoader(mock_app)
    loader._plugins_dir = tmp_path

    plugin_dir = tmp_path / "test-plugin"
    plugin_dir.mkdir()

    main_py = plugin_dir / "main.py"
    main_py.touch()

    mock_module = MagicMock()
    mock_module.register_plugin = MagicMock()
    mock_import.return_value = mock_module

    result = loader.load_plugin("test-plugin")

    assert result is True
    mock_import.assert_called_once_with("test-plugin.main")
    mock_module.register_plugin.assert_called_once_with(mock_app)
