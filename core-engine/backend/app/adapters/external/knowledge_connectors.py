# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Knowledge Connector Framework — đồng bộ tri thức từ nguồn ngoài vào Proteus.
# Connector chỉ CHỊU TRÁCH NHIỆM ĐỌC + chuẩn hoá dữ liệu; việc ghi vào nguồn
# đích (Outline) do use case/publisher lo. Đăng ký connector mới bằng
# `register_connector()` — framework mở rộng không cần sửa core.

import logging
from typing import Any

import httpx

from app.core.domain.ports import AbstractKnowledgeConnectorPort

logger = logging.getLogger(__name__)


class ConnectorError(Exception):
    pass


# ─── Registry ────────────────────────────────────────────────────────────

_CONNECTOR_REGISTRY: dict[str, type[AbstractKnowledgeConnectorPort]] = {}


def register_connector(cls: type[AbstractKnowledgeConnectorPort]) -> type:
    """Decorator đăng ký connector theo `name`."""
    name = getattr(cls, "name", None) or cls.__name__.lower()
    _CONNECTOR_REGISTRY[name] = cls
    return cls


def get_connector(name: str) -> type[AbstractKnowledgeConnectorPort] | None:
    return _CONNECTOR_REGISTRY.get(name)


def list_connectors() -> list[str]:
    return sorted(_CONNECTOR_REGISTRY.keys())


# ─── Connector mẫu: HTTP JSON Feed ───────────────────────────────────────
# Đọc 1 URL trả JSON dạng {"documents": [{"title","text","id","url"}]} hoặc
# list trực tiếp. Dùng cho nguồn nội bộ/đối tác đã expose API đơn giản.


@register_connector
class HttpFeedConnector(AbstractKnowledgeConnectorPort):
    """Connector mẫu: kéo documents từ 1 HTTP JSON endpoint."""

    name = "http_feed"

    async def fetch_documents(self, *, config: dict[str, Any]) -> list[dict[str, Any]]:
        url = (config or {}).get("url")
        if not url:
            raise ConnectorError("http_feed cần config.url")
        headers = (config or {}).get("headers") or {}
        timeout = float((config or {}).get("timeout", 15.0))

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(url, headers=headers, timeout=timeout)
                resp.raise_for_status()
                payload = resp.json()
            except httpx.HTTPError as e:
                raise ConnectorError(f"http_feed fetch thất bại: {e}") from e
            except ValueError as e:
                raise ConnectorError(f"http_feed không trả JSON hợp lệ: {e}") from e

        raw_items = (
            payload.get("documents")
            if isinstance(payload, dict)
            else payload if isinstance(payload, list) else []
        )
        documents: list[dict[str, Any]] = []
        for item in raw_items or []:
            if not isinstance(item, dict):
                continue
            title = str(item.get("title") or "").strip()
            text = str(item.get("text") or item.get("content") or "").strip()
            if not title or not text:
                continue
            documents.append(
                {
                    "title": title,
                    "text": text,
                    "external_id": item.get("id") or item.get("external_id"),
                    "source_url": item.get("url") or item.get("source_url"),
                }
            )
        logger.info("http_feed: fetched %s documents", len(documents))
        return documents
