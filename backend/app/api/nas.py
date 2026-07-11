"""Authenticated, read-only NAS photo browser and import API."""
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user_or_enforce
from app.models.user import User
from app.services.file_service import file_service
from app.services.image_import_service import register_uploaded_copy
from app.services.nas_service import nas_service

router = APIRouter()


class NASImportRequest(BaseModel):
    relative_paths: List[str] = Field(min_length=1)


@router.get("/status")
async def nas_status(current_user: Optional[User] = Depends(get_current_user_or_enforce)):
    return {"enabled": settings.nas_browser_enabled, "max_import_files": settings.nas_max_import_files}


@router.get("/browse")
async def browse_nas(path: str = Query(default=""), current_user: Optional[User] = Depends(get_current_user_or_enforce)):
    return await nas_service.browse(path)


@router.post("/import")
async def import_nas(request: NASImportRequest, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_current_user_or_enforce)):
    nas_service.require_enabled()
    if len(request.relative_paths) > settings.nas_max_import_files:
        raise HTTPException(status_code=422, detail=f"At most {settings.nas_max_import_files} files can be imported at once")
    imported, failed = [], []
    user_id = current_user.id if current_user else None
    for relative_path in request.relative_paths:
        try:
            source = nas_service.resolve_relative_path(relative_path)
            valid, error, mime_type = await file_service.validate_local_image(source)
            if not valid:
                raise HTTPException(status_code=422, detail=error)
            stored, destination, size = await file_service.copy_into_uploads(source, source.name, user_id)
            image = await register_uploaded_copy(db, stored_filename=stored, file_path=destination, file_size=size,
                                                original_filename=source.name, mime_type=mime_type, user_id=user_id)
            imported.append({"id": image.id, "original_filename": image.original_filename,
                             "stored_filename": image.stored_filename, "thumbnail_url": f"/api/images/{image.id}/thumbnail",
                             "mime_type": image.mime_type, "file_size": image.file_size, "width": image.width,
                             "height": image.height, "format": image.format, "created_at": image.created_at})
        except HTTPException as error:
            failed.append({"relative_path": relative_path, "error": error.detail})
        except Exception as error:
            failed.append({"relative_path": relative_path, "error": str(error)})
    return {"images": imported, "failed": failed}
