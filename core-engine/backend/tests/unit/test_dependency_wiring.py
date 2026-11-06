# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Regression tests: DI factory phải khớp constructor của Use Case (#681)."""

import inspect
from unittest.mock import MagicMock

from app.core.use_cases.ai_chat import AIChatUseCase
from app.core.use_cases.ai_command import AICommandUseCase
from app.entrypoints import dependencies


def _mock_kwargs(factory) -> dict:
    """Build mock cho mọi tham số `Depends(...)` của factory."""
    return {name: MagicMock() for name in inspect.signature(factory).parameters}


async def test_get_ai_command_use_case_resolves_without_type_error():
    """Factory không được truyền tham số mà AICommandUseCase không khai báo."""
    use_case = await dependencies.get_ai_command_use_case(
        **_mock_kwargs(dependencies.get_ai_command_use_case)
    )
    assert isinstance(use_case, AICommandUseCase)


async def test_get_ai_chat_use_case_resolves_without_type_error():
    use_case = await dependencies.get_ai_chat_use_case(
        **_mock_kwargs(dependencies.get_ai_chat_use_case)
    )
    assert isinstance(use_case, AIChatUseCase)


def test_ai_command_factory_params_are_subset_of_constructor():
    """Mọi kwarg factory dùng phải tồn tại trong __init__ của use case."""
    ctor_params = set(inspect.signature(AICommandUseCase.__init__).parameters)
    factory_source = inspect.getsource(dependencies.get_ai_command_use_case)
    assert "conversation_repo=" not in factory_source
    assert "plugin_repo" in ctor_params
