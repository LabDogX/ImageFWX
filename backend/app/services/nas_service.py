"""Read-only, path-confined NAS browsing and import helpers."""
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
from pathlib import Path, PureWindowsPath
from typing import Dict, List
from urllib.parse import unquote

from fastapi import HTTPException

from app.core.config import settings
from app.services.file_service import file_service


class NASService:
    def _root(self) -> Path:
        return Path(settings.nas_source_dir).resolve(strict=False)

    def require_enabled(self) -> None:
        if not settings.nas_browser_enabled:
            raise HTTPException(status_code=404, detail="NAS browser is disabled")

    def resolve_relative_path(self, relative_path: str) -> Path:
        """Resolve only a relative child, including URL-encoded traversal protection."""
        if not isinstance(relative_path, str):
            raise HTTPException(status_code=422, detail="Path must be a string")
        decoded = relative_path
        for _ in range(2):
            next_value = unquote(decoded)
            if next_value == decoded:
                break
            decoded = next_value
        if not decoded or Path(decoded).is_absolute() or PureWindowsPath(decoded).is_absolute():
            raise HTTPException(status_code=422, detail="Only relative NAS paths are allowed")
        if "\\" in decoded or any(part in ("", ".", "..") for part in Path(decoded).parts):
            raise HTTPException(status_code=422, detail="Invalid NAS path")
        root = self._root()
        candidate = (root / decoded).resolve(strict=False)
        try:
            candidate.relative_to(root)
        except ValueError:
            raise HTTPException(status_code=422, detail="NAS path escapes source directory")
        return candidate

    def relative(self, path: Path) -> str:
        relative_path = path.resolve().relative_to(self._root()).as_posix()
        return "" if relative_path == "." else relative_path

    def thumbnail_cache_path(self, relative_path: str, source: Path) -> Path:
        """Return an opaque temp-cache path without exposing the NAS path."""
        stat = source.stat()
        fingerprint = f"{relative_path}\0{stat.st_size}\0{stat.st_mtime_ns}".encode("utf-8")
        digest = hashlib.sha256(fingerprint).hexdigest()
        return Path(settings.temp_dir) / "nas-thumbnails" / f"{digest}.webp"

    async def browse(self, relative_path: str = "") -> Dict:
        self.require_enabled()
        root = self._root()
        directory = root if not relative_path else self.resolve_relative_path(relative_path)
        if not directory.is_dir():
            raise HTTPException(status_code=404, detail="NAS directory not found")
        directories: List[Dict] = []
        files: List[Dict] = []
        for entry in sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.casefold())):
            # Resolve each entry so symlinks that leave the mount are never exposed.
            try:
                resolved = entry.resolve(strict=True)
                resolved.relative_to(root)
            except (FileNotFoundError, ValueError):
                continue
            if resolved.is_dir():
                directories.append({"name": entry.name, "relative_path": self.relative(resolved)})
            elif resolved.is_file() and resolved.suffix.lower() in settings.allowed_extensions:
                valid, _, mime = await file_service.validate_local_image(resolved)
                if valid:
                    stat = resolved.stat()
                    files.append({"name": entry.name, "relative_path": self.relative(resolved), "size": stat.st_size,
                                  "modified_at": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat().replace("+00:00", "Z")})
        parent = None if directory == root else self.relative(directory.parent)
        return {"path": "" if directory == root else self.relative(directory), "parent": parent,
                "directories": directories, "files": files}


nas_service = NASService()
