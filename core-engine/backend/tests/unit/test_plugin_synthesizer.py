# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

from unittest.mock import patch

import pytest

from app.ai.plugin_synthesizer import PluginSynthesizer


@pytest.mark.asyncio
@patch("app.ai.plugin_synthesizer.os.getenv")
async def test_mock_synthesize(mock_getenv, tmp_path):
    mock_getenv.return_value = "dummy"

    synthesizer = PluginSynthesizer()
    synthesizer._plugins_dir = tmp_path

    plugin_name = await synthesizer.synthesize("tạo plugin bệnh viện")

    assert plugin_name == "hospital-module"

    # Check generated files
    plugin_path = tmp_path / "hospital-module"
    assert plugin_path.exists()
    assert (plugin_path / "manifest.yaml").exists()
    assert (plugin_path / "db" / "seed_data.sql").exists()
    assert (plugin_path / "main.py").exists()


@pytest.mark.asyncio
@patch("app.ai.plugin_synthesizer.os.getenv")
async def test_mock_synthesize_generic(mock_getenv, tmp_path):
    mock_getenv.return_value = "dummy"

    synthesizer = PluginSynthesizer()
    synthesizer._plugins_dir = tmp_path

    plugin_name = await synthesizer.synthesize("create a random module")

    assert plugin_name == "demo-module"
    assert (tmp_path / "demo-module" / "manifest.yaml").exists()
