# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Infrastructure Layer — Logging Configuration
# Dùng structlog để tạo log dạng JSON chuẩn (production-ready)
# TUYỆT ĐỐI KHÔNG dùng print() trong toàn bộ codebase

import logging
import sys

import structlog


def setup_logging(level: str = "INFO") -> None:
    """
    Khởi tạo logging cho toàn bộ ứng dụng.
    Gọi hàm này MỘT LẦN DUY NHẤT tại main.py trước khi app khởi động.
    """
    log_level = getattr(logging, level.upper(), logging.INFO)

    # Cấu hình structlog processors
    shared_processors: list = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        # JSON format cho production, console format cho development
        processor=structlog.dev.ConsoleRenderer()
        if level == "DEBUG"
        else structlog.processors.JSONRenderer(),
        foreign_pre_chain=shared_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(log_level)

    # Giảm noise từ các library bên ngoài
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
