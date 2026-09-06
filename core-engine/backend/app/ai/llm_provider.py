# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# AI Engine - Local LLM Provider Adapter
# Giao tiếp với Local LLM (vLLM / Ollama) thông qua OpenAI-compatible API.

import logging

import httpx

from app.core.domain.ports import AbstractLLMPort

logger = logging.getLogger(__name__)


class LLMResponse:
    """Mock LangChain response object"""

    def __init__(self, content: str):
        self.content = content


class LocalLLMProvider(AbstractLLMPort):
    def __init__(self, base_url: str, model_name: str, api_key: str = "dummy"):
        self.base_url = base_url.rstrip("/")
        self.model_name = model_name
        self.api_key = api_key

    async def ainvoke(self, messages: list[dict[str, str]]) -> LLMResponse:
        """
        Gọi endpoint /chat/completions chuẩn OpenAI.
        messages = [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}]
        """
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": 0.0,
        }

        logger.info(
            f"Sending request to Local LLM at {url} with model {self.model_name}"
        )

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return LLMResponse(content=content)
            except httpx.HTTPStatusError as e:
                logger.error(f"Local LLM API error: {e.response.text}")
                raise e
            except Exception as e:
                logger.error(f"Failed to communicate with Local LLM: {str(e)}")
                raise e
