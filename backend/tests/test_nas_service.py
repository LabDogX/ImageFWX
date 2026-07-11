from pathlib import Path
import hashlib

import pytest
from fastapi import HTTPException

from app.services.nas_service import NASService
from app.services.file_service import file_service


@pytest.fixture
def nas_root(tmp_path, monkeypatch):
    root = tmp_path / "photos"
    root.mkdir()
    monkeypatch.setattr("app.services.nas_service.settings.nas_source_dir", str(root))
    monkeypatch.setattr("app.services.nas_service.settings.nas_browser_enabled", True)
    return root


def test_resolve_only_accepts_safe_relative_files(nas_root):
    photo = nas_root / "2026" / "Trip" / "photo.jpg"
    photo.parent.mkdir(parents=True)
    photo.write_bytes(b"test")
    service = NASService()
    assert service.resolve_relative_path("2026/Trip/photo.jpg") == photo.resolve()


@pytest.mark.parametrize("value", ["../secret.jpg", "%2e%2e/secret.jpg", "/etc/passwd", "C:\\Windows\\win.ini", "folder\\photo.jpg"])
def test_resolve_rejects_traversal_and_absolute_paths(nas_root, value):
    with pytest.raises(HTTPException) as error:
        NASService().resolve_relative_path(value)
    assert error.value.status_code == 422


def test_resolve_rejects_symlink_escape(nas_root, tmp_path):
    outside = tmp_path / "outside.jpg"
    outside.write_bytes(b"test")
    (nas_root / "escape.jpg").symlink_to(outside)
    with pytest.raises(HTTPException):
        NASService().resolve_relative_path("escape.jpg")


def test_disabled_nas_is_not_browsable(nas_root, monkeypatch):
    monkeypatch.setattr("app.services.nas_service.settings.nas_browser_enabled", False)
    with pytest.raises(HTTPException) as error:
        NASService().require_enabled()
    assert error.value.status_code == 404


@pytest.mark.asyncio
async def test_non_image_is_rejected_and_copy_preserves_source(nas_root, tmp_path, monkeypatch):
    text_file = nas_root / "notes.txt"
    text_file.write_text("not an image")
    monkeypatch.setattr(file_service, "_detect_mime", lambda *_args, **_kwargs: "text/plain")
    valid, _, _ = await file_service.validate_local_image(text_file)
    assert not valid

    photo = nas_root / "photo.jpg"
    photo.write_bytes(b"immutable source bytes")
    source_hash = hashlib.sha256(photo.read_bytes()).hexdigest()
    monkeypatch.setattr(file_service, "upload_dir", tmp_path / "uploads")
    _, copy_path, _ = await file_service.copy_into_uploads(photo, photo.name)
    assert Path(copy_path).read_bytes() == photo.read_bytes()
    assert hashlib.sha256(photo.read_bytes()).hexdigest() == source_hash
