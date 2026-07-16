from __future__ import annotations

import hashlib
import mimetypes
import os
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock

from PIL import Image

from .constants import MAX_ARTIFACT_BYTES
from .errors import InvalidArgumentError, NotFoundError
from .models import ArtifactRef
from .paths import cache_dir


@dataclass(frozen=True, slots=True)
class ArtifactRecord:
    ref: ArtifactRef
    path: Path


class ArtifactStore:
    def __init__(self, root: Path | None = None) -> None:
        self.root = root or cache_dir() / "artifacts"
        self.root.mkdir(parents=True, exist_ok=True)
        self._records: dict[str, ArtifactRecord] = {}
        self._lock = RLock()

    def add_bytes(
        self,
        data: bytes,
        *,
        kind: str,
        mime_type: str = "application/octet-stream",
        session_id: str | None = None,
        run_id: str | None = None,
    ) -> ArtifactRef:
        if len(data) > MAX_ARTIFACT_BYTES:
            raise InvalidArgumentError(
                f"artifact 超过 {MAX_ARTIFACT_BYTES // 1024 // 1024} MiB 限制"
            )
        artifact_id = secrets.token_urlsafe(24)
        suffix = mimetypes.guess_extension(mime_type) or ".bin"
        path = self.root / f"{artifact_id}{suffix}"
        temp = path.with_suffix(f"{path.suffix}.{os.getpid()}.tmp")
        temp.write_bytes(data)
        temp.replace(path)

        width: int | None = None
        height: int | None = None
        if mime_type.startswith("image/"):
            try:
                with Image.open(path) as image:
                    width, height = image.size
            except OSError:
                width = height = None

        ref = ArtifactRef(
            artifact_id=artifact_id,
            kind=kind,
            mime_type=mime_type,
            size=len(data),
            sha256=hashlib.sha256(data).hexdigest(),
            width=width,
            height=height,
            session_id=session_id,
            run_id=run_id,
            created_at=datetime.now(UTC),
        )
        with self._lock:
            self._records[artifact_id] = ArtifactRecord(ref=ref, path=path)
        return ref

    def add_path(
        self,
        path: Path,
        *,
        kind: str,
        session_id: str | None = None,
        run_id: str | None = None,
    ) -> ArtifactRef:
        mime_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        return self.add_bytes(
            path.read_bytes(),
            kind=kind,
            mime_type=mime_type,
            session_id=session_id,
            run_id=run_id,
        )

    def get(self, artifact_id: str) -> ArtifactRecord:
        with self._lock:
            record = self._records.get(artifact_id)
        if record is None or not record.path.is_file():
            raise NotFoundError("artifact 不存在或已过期")
        return record

    def delete_session(self, session_id: str) -> None:
        with self._lock:
            ids = [
                artifact_id
                for artifact_id, record in self._records.items()
                if record.ref.session_id == session_id
            ]
            records = [self._records.pop(artifact_id) for artifact_id in ids]
        for record in records:
            record.path.unlink(missing_ok=True)

    def clear(self) -> None:
        with self._lock:
            records = list(self._records.values())
            self._records.clear()
        for record in records:
            record.path.unlink(missing_ok=True)
