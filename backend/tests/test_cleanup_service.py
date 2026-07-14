import os
import time
from pathlib import Path

from app.services.cleanup_service import CleanupService
from app.services.file_service import file_service


def _make_old(path: Path) -> None:
    path.write_bytes(b"old")
    old_time = time.time() - 3 * 60 * 60
    os.utime(path, (old_time, old_time))


def test_remove_files_older_than_respects_retention_and_preserved_paths(tmp_path):
    managed = tmp_path / "managed"
    managed.mkdir()
    expired = managed / "expired.webp"
    preserved = managed / "preserved.webp"
    recent = managed / "recent.webp"
    _make_old(expired)
    _make_old(preserved)
    recent.write_bytes(b"recent")

    deleted = CleanupService().remove_files_older_than(
        managed,
        retention_hours=1,
        preserve=[preserved],
    )

    assert deleted == 1
    assert not expired.exists()
    assert preserved.exists()
    assert recent.exists()


def test_remove_files_older_than_never_follows_symlink_outside_managed_root(tmp_path):
    managed = tmp_path / "managed"
    managed.mkdir()
    outside = tmp_path / "outside.jpg"
    _make_old(outside)
    (managed / "outside-link.jpg").symlink_to(outside)

    deleted = CleanupService().remove_files_older_than(managed, retention_hours=1)

    assert deleted == 0
    assert outside.exists()
    assert (managed / "outside-link.jpg").exists()


def test_zero_retention_disables_directory_cleanup(tmp_path):
    expired = tmp_path / "expired.png"
    _make_old(expired)

    assert CleanupService().remove_files_older_than(tmp_path, retention_hours=0) == 0
    assert expired.exists()


def test_expired_image_cleanup_never_unlinks_paths_outside_uploads(tmp_path, monkeypatch):
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    outside = tmp_path / "outside.jpg"
    outside.write_bytes(b"do not delete")
    monkeypatch.setattr(file_service, "upload_dir", uploads)

    assert not CleanupService()._remove_managed_upload(str(outside))
    assert outside.exists()
