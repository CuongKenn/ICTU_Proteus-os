# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# AI Engine - Local LLM Provider Adapter
# Giao tiếp với Local LLM (vLLM / Ollama) thông qua OpenAI-compatible API.

import logging
import re

import httpx

from app.core.domain.ports import AbstractLLMPort

logger = logging.getLogger(__name__)


class LLMResponse:
    """Mock LangChain response object"""

    def __init__(self, content: str):
        self.content = content


def extract_json_object(text: str) -> str:
    """Trích JSON object từ output LLM (chịu code fence/text thừa).

    Ưu tiên khối ```json ... ```, fallback ngoặc {} cân bằng đầu tiên.
    Raise ValueError nếu không tìm thấy.
    """
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        return fence.group(1)
    start = text.find("{")
    if start == -1:
        raise ValueError("LLM output không chứa JSON object.")
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    raise ValueError("LLM output chứa JSON không cân bằng.")


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
        return await self._post_chat(messages, extra={})

    async def ainvoke_json(self, messages: list[dict[str, str]]) -> LLMResponse:
        """Gọi LLM yêu cầu trả về JSON object (structured output).

        Gửi response_format json_object; server cũ không hỗ trợ (400) thì
        fallback gọi thường — parse robust ở extract_json_object.
        """
        try:
            return await self._post_chat(
                messages, extra={"response_format": {"type": "json_object"}}
            )
        except httpx.HTTPStatusError as e:
            if e.response is not None and e.response.status_code == 400:
                logger.warning(
                    "LLM server không hỗ trợ response_format, fallback gọi thường."
                )
                return await self._post_chat(messages, extra={})
            raise

    async def astream(self, messages: list[dict[str, str]]):
        """Stream tokens SSE OpenAI-compatible (delta content từng chunk).

        Async generator yield str. Server không hỗ trợ stream thì raise.
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
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST", url, headers=headers, json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        import json as _json

                        chunk = _json.loads(data)
                        delta = (
                            chunk["choices"][0].get("delta", {}).get("content") or ""
                        )
                    except Exception:
                        continue
                    if delta:
                        yield delta

    async def _post_chat(
        self, messages: list[dict[str, str]], extra: dict
    ) -> LLMResponse:
        """POST /chat/completions (dùng chung cho ainvoke/ainvoke_json)."""
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": 0.0,
            **extra,
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
