"""Safe, retention-based cleanup for application-owned storage only."""

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, Set

from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session_maker
from app.models.image import Image
from app.services.file_service import file_service

logger = logging.getLogger(__name__)


@dataclass
class CleanupResult:
    """Counts emitted by one cleanup pass."""

    expired_images: int = 0
    upload_orphans: int = 0
    temp_files: int = 0
    processed_files: int = 0


class CleanupService:
    """Remove expired application files without ever traversing NAS sources."""

    @staticmethod
    def _is_within(path: Path, root: Path) -> bool:
        """Return whether a resolved path remains within a managed root."""
        try:
            path.resolve().relative_to(root.resolve())
            return True
        except (OSError, ValueError):
            return False

    def remove_files_older_than(
        self,
        directory: Path,
        retention_hours: int,
        *,
        preserve: Iterable[Path] = (),
    ) -> int:
        """Delete old regular files below one managed directory.

        Symlinks and paths resolving outside the directory are deliberately
        ignored. ``retention_hours=0`` disables a directory's cleanup.
        """
        if retention_hours == 0 or not directory.exists():
            return 0

        root = directory.resolve()
        preserved: Set[Path] = {path.resolve() for path in preserve}
        cutoff = time.time() - retention_hours * 60 * 60
        deleted = 0

        try:
            candidates = list(root.rglob("*"))
        except OSError as error:
            logger.warning("Could not scan cleanup directory %s: %s", root, error)
            return 0

        for candidate in candidates:
            try:
                if candidate.is_symlink() or not candidate.is_file():
                    continue
                resolved = candidate.resolve()
                if resolved in preserved or not self._is_within(resolved, root):
                    continue
                if candidate.stat().st_mtime >= cutoff:
                    continue
                candidate.unlink()
                deleted += 1
            except OSError as error:
                logger.warning("Could not remove expired file %s: %s", candidate, error)

        return deleted

    def _remove_managed_upload(self, value: str | None) -> bool:
        """Remove a database-referenced file only if it is under uploads."""
        if not value:
            return False
        path = Path(value)
        if not self._is_within(path, file_service.upload_dir):
            logger.warning("Skipping cleanup path outside uploads: %s", path)
            return False
        try:
            if path.is_file() and not path.is_symlink():
                path.unlink()
                return True
        except OSError as error:
            logger.warning("Could not remove expired upload %s: %s", path, error)
        return False

    async def remove_expired_images(self) -> int:
        """Remove expired Image rows and their application-owned upload files."""
        async with async_session_maker() as session:
            result = await session.scalars(
                select(Image).where(
                    Image.expires_at.is_not(None),
                    Image.expires_at <= datetime.utcnow(),
                )
            )
            images = list(result)
            for image in images:
                self._remove_managed_upload(image.file_path)
                self._remove_managed_upload(image.thumbnail_path)
                await session.delete(image)
            if images:
                await session.commit()
            return len(images)

    async def remove_upload_orphans(self) -> int:
        """Remove old upload files no longer referenced by an Image row."""
        async with async_session_maker() as session:
            rows = await session.execute(select(Image.file_path, Image.thumbnail_path))
            referenced = {
                Path(value)
                for row in rows
                for value in row
                if value
            }
        return self.remove_files_older_than(
            file_service.upload_dir,
            settings.history_retention_hours,
            preserve=referenced,
        )

    async def run_once(self) -> CleanupResult:
        """Run one complete retention pass for writable application storage."""
        if not settings.cleanup_enabled:
            return CleanupResult()

        expired_images = await self.remove_expired_images()
        upload_orphans = await self.remove_upload_orphans()
        temp_files = await asyncio.to_thread(
            self.remove_files_older_than,
            file_service.temp_dir,
            settings.temp_retention_hours,
        )
        processed_files = await asyncio.to_thread(
            self.remove_files_older_than,
            file_service.processed_dir,
            settings.processed_retention_hours,
        )
        return CleanupResult(expired_images, upload_orphans, temp_files, processed_files)


cleanup_service = CleanupService()
