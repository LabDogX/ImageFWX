"""Long-running, low-frequency cleanup worker started by the app container."""

import asyncio
import logging
import time

from app.core.config import settings
from app.services.cleanup_service import cleanup_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    """Run cleanup passes until the container is stopped."""
    if not settings.cleanup_enabled:
        logger.info("Scheduled file cleanup is disabled")
        return

    interval_seconds = settings.cleanup_interval_minutes * 60
    logger.info(
        "Scheduled cleanup enabled: every %s minutes (history=%sh, temp=%sh, processed=%sh)",
        settings.cleanup_interval_minutes,
        settings.history_retention_hours,
        settings.temp_retention_hours,
        settings.processed_retention_hours,
    )
    while True:
        try:
            result = asyncio.run(cleanup_service.run_once())
            logger.info("Cleanup finished: %s", result)
        except Exception:
            logger.exception("Scheduled cleanup pass failed")
        time.sleep(interval_seconds)


if __name__ == "__main__":
    main()
