from pathlib import Path
from types import SimpleNamespace

import pytest

from app.api.nas import NASImportRequest, import_nas
from app.services.file_service import file_service
from app.services.nas_service import nas_service


@pytest.mark.asyncio
async def test_import_copy_failure_reports_safe_stage(monkeypatch):
    monkeypatch.setattr(nas_service, "require_enabled", lambda: None)
    monkeypatch.setattr(nas_service, "resolve_relative_path", lambda _path: Path("/private/source/photo.jpg"))

    async def valid_image(_path):
        return True, "", "image/jpeg"

    async def copy_failure(*_args, **_kwargs):
        raise PermissionError("[Errno 13] Permission denied: '/private/source/photo.jpg'")

    monkeypatch.setattr(file_service, "validate_local_image", valid_image)
    monkeypatch.setattr(file_service, "copy_into_uploads", copy_failure)

    result = await import_nas(
        NASImportRequest(relative_paths=["album/photo.jpg"]),
        db=SimpleNamespace(),
        current_user=SimpleNamespace(id=1),
    )

    assert result["images"] == []
    assert result["failed"] == [{
        "relative_path": "album/photo.jpg",
        "error_code": "copy_failed",
        "error": "Unable to copy the file into application storage",
    }]
