"""Shared upload/NAS image ingestion workflow.

Every caller first puts a private working copy in /app/uploads; NAS source files
are therefore never referenced by image records or thumbnail generation.
"""
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.image import Image
from app.services.file_service import file_service
from app.services.imagemagick import imagemagick_service


async def register_uploaded_copy(
    db: AsyncSession, *, stored_filename: str, file_path: str, file_size: int,
    original_filename: str, mime_type: str, user_id: Optional[int],
) -> Image:
    """Generate metadata/thumbnail and create the canonical Image database row."""
    image_info = await imagemagick_service.get_image_info(file_path)
    thumbnail_path = await file_service.create_thumbnail(file_path, user_id)
    image = Image(
        user_id=user_id, original_filename=original_filename or "unknown",
        stored_filename=stored_filename, file_path=file_path,
        thumbnail_path=thumbnail_path, mime_type=mime_type, file_size=file_size,
        width=image_info.get("width") if image_info else None,
        height=image_info.get("height") if image_info else None,
        format=image_info.get("format") if image_info else None,
        image_metadata=image_info or {},
        expires_at=datetime.utcnow() + timedelta(hours=settings.history_retention_hours),
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)
    return image
