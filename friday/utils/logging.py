"""Logging infrastructure for Friday.

Usage:
    from friday.utils.logging import get_logger, configure_logging
    configure_logging(level="INFO")
    logger = get_logger(__name__)
    logger.info("hello", extra={"request_id": "..."})

- Structured, human-readable format with timestamp/level/logger/message.
- Respects FRIDAY_LOG_LEVEL env var when configure_logging() is called without args.
- Safe to call configure_logging() multiple times (idempotent).
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Literal

_LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

_configured = False

LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]


def configure_logging(
    level: LogLevel | int | None = None,
    *,
    force: bool = False,
) -> None:
    """Configure root logging for the Friday process.

    Args:
        level: Log level string or int. If None, reads FRIDAY_LOG_LEVEL env var
               (defaults to INFO).
        force: If True, reconfigure even if already configured.
    """
    global _configured
    if _configured and not force:
        return

    if level is None:
        level = os.getenv("FRIDAY_LOG_LEVEL", "INFO").upper()

    if isinstance(level, str):
        level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(fmt=_LOG_FORMAT, datefmt=_DATE_FORMAT))

    root = logging.getLogger()
    # Remove existing handlers if force, otherwise keep idempotency
    if force:
        root.handlers.clear()
    # Avoid duplicate handlers on repeated calls
    if not any(isinstance(h, logging.StreamHandler) for h in root.handlers):
        root.addHandler(handler)
    root.setLevel(level)

    # Quiet noisy libs in production-like setups
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    _configured = True


def get_logger(name: str) -> logging.Logger:
    """Return a logger for the given dotted name."""
    # Ensure logging is configured at least once with defaults
    if not _configured:
        configure_logging()
    return logging.getLogger(name)
