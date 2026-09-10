# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import logging
import uuid
from typing import Any

from app.core.domain.ports import AbstractManifestParserPort
from app.infrastructure.database import AsyncSessionLocal
from app.adapters.repositories.plugin_repo import SQLAlchemyPluginRepository
from app.adapters.external.n8n_adapter import N8nAdapter
from app.adapters.external.local_manifest_parser import ManifestParserError

logger = logging.getLogger(__name__)

class EventSubscriberWorker:
    """
    Worker lắng nghe Event Bus và tự động kích hoạt n8n webhooks
    của các Plugins đã subscribe event tương ứng.
    """

    def __init__(
        self,
        manifest_parser: AbstractManifestParserPort,
        n8n_adapter: N8nAdapter,
    ):
        self.manifest_parser = manifest_parser
        self.n8n_adapter = n8n_adapter

    async def handle_event(self, envelope: dict[str, Any]) -> None:
        """Hàm xử lý một event đến từ Redis."""
        tenant_id_str = envelope.get("tenant_id")
        event_type = envelope.get("event_type")
        plugin_source = envelope.get("plugin_source")
        payload = envelope.get("payload", {})
        event_id = envelope.get("event_id")

        if not tenant_id_str or not event_type or not plugin_source:
            logger.warning("Event envelope thiếu thông tin bắt buộc, bỏ qua.", extra={"envelope": envelope})
            return

        try:
            tenant_id = uuid.UUID(tenant_id_str)
        except ValueError:
            logger.warning(f"Invalid tenant_id format: {tenant_id_str}")
            return

        logger.debug(f"Received event {event_type} from {plugin_source}", extra={"event_id": event_id})

        # Mở session mới cho mỗi event để không giữ connection quá lâu
        async with AsyncSessionLocal() as session:
            plugin_repo = SQLAlchemyPluginRepository(session=session)
            plugins, _ = await plugin_repo.list_installed(tenant_id)
            
            # Quét manifest của các plugin đang active
            for p in plugins:
                try:
                    manifest = self.manifest_parser.parse(p.code_name)
                    # Tìm xem có subscription nào khớp không
                    for sub in manifest.event_subscriptions:
                        if sub.source_plugin == plugin_source and event_type in sub.event_types:
                            # TÌM THẤY MATCH! Trigger workflow.
                            webhook_url = self.n8n_adapter.build_webhook_url(sub.handler_workflow)
                            
                            # Đẩy thêm metadata vào payload để n8n biết source
                            enriched_payload = {
                                **payload,
                                "_event_metadata": {
                                    "event_id": event_id,
                                    "event_type": event_type,
                                    "source_plugin": plugin_source,
                                    "tenant_id": tenant_id_str
                                }
                            }
                            
                            try:
                                await self.n8n_adapter.trigger_webhook(
                                    webhook_url=webhook_url,
                                    payload=enriched_payload
                                )
                                logger.info(
                                    "Cross-plugin workflow triggered",
                                    extra={
                                        "triggering_event": event_type,
                                        "source_plugin": plugin_source,
                                        "target_plugin": p.code_name,
                                        "workflow": sub.handler_workflow
                                    }
                                )
                            except Exception as trigger_err:
                                logger.error(
                                    f"Failed to trigger subscriber workflow {sub.handler_workflow}",
                                    exc_info=True
                                )
                                
                except ManifestParserError:
                    logger.warning(f"Failed to parse manifest for active plugin {p.code_name}")
                except Exception as e:
                    logger.error(f"Error checking subscriptions for {p.code_name}", exc_info=True)

