"""Authenticated, read-only NAS photo browser and import API."""
import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user_or_enforce
from app.models.user import User
from app.services.file_service import file_service
from app.services.image_import_service import register_uploaded_copy
from app.services.nas_service import nas_service
from app.services.imagemagick import imagemagick_service

router = APIRouter()
logger = logging.getLogger(__name__)


class NASImportRequest(BaseModel):
    relative_paths: List[str] = Field(min_length=1)


@router.get("/status")
async def nas_status(current_user: Optional[User] = Depends(get_current_user_or_enforce)):
    return {"enabled": settings.nas_browser_enabled, "max_import_files": settings.nas_max_import_files}


@router.get("/browse")
async def browse_nas(path: str = Query(default=""), current_user: Optional[User] = Depends(get_current_user_or_enforce)):
    return await nas_service.browse(path)


@router.get("/thumbnail")
async def get_nas_thumbnail(
    path: str = Query(min_length=1),
    current_user: Optional[User] = Depends(get_current_user_or_enforce),
):
    """Generate a temporary, authenticated thumbnail for a safe NAS image."""
    nas_service.require_enabled()
    source = nas_service.resolve_relative_path(path)
    if not source.is_file():
        raise HTTPException(status_code=404, detail="NAS image not found")
    valid, error, _ = await file_service.validate_local_image(source)
    if not valid:
        raise HTTPException(status_code=422, detail=error or "Unsupported NAS image")
    thumbnail_path = nas_service.thumbnail_cache_path(path, source)
    if not thumbnail_path.exists():
        thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
        created = await imagemagick_service.create_thumbnail(str(source), str(thumbnail_path), size=300)
        if not created or not thumbnail_path.exists():
            raise HTTPException(status_code=422, detail="Unable to create NAS thumbnail")
    return FileResponse(
        thumbnail_path,
        media_type="image/webp",
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.post("/import")
async def import_nas(request: NASImportRequest, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_or_enforce)):
    nas_service.require_enabled()
    if len(request.relative_paths) > settings.nas_max_import_files:
        raise HTTPException(status_code=422, detail=f"At most {settings.nas_max_import_files} files can be imported at once")
    imported, failed = [], []
    user_id = current_user.id if current_user else None
    for relative_path in request.relative_paths:
        stage = "validation"
        try:
            source = nas_service.resolve_relative_path(relative_path)
            valid, error, mime_type = await file_service.validate_local_image(source)
            if not valid:
                raise HTTPException(status_code=422, detail=error)
            stage = "copy"
            stored, destination, size = await file_service.copy_into_uploads(source, source.name, user_id)
            stage = "registration"
            image = await register_uploaded_copy(db, stored_filename=stored, file_path=destination, file_size=size,
                                                original_filename=source.name, mime_type=mime_type, user_id=user_id)
            imported.append({"id": image.id, "original_filename": image.original_filename,
                             "stored_filename": image.stored_filename, "thumbnail_url": f"/api/images/{image.id}/thumbnail",
                             "mime_type": image.mime_type, "file_size": image.file_size, "width": image.width,
                             "height": image.height, "format": image.format, "created_at": image.created_at})
        except HTTPException as error:
            failed.append({"relative_path": relative_path, "error": error.detail})
        except Exception:
            logger.exception("NAS import failed during %s", stage)
            failure = {
                "copy": ("copy_failed", "Unable to copy the file into application storage"),
                "registration": ("registration_failed", "Unable to add the imported file to the image library"),
            }.get(stage, ("validation_failed", "Unable to validate the selected file"))
            failed.append({"relative_path": relative_path, "error_code": failure[0], "error": failure[1]})
    return {"images": imported, "failed": failed}
