from __future__ import annotations

from pathlib import Path

import pytest

from mpe_localbridge.artifacts import ArtifactStore
from mpe_localbridge.constants import MAX_ARTIFACT_BYTES
from mpe_localbridge.errors import InvalidArgumentError, NotFoundError


def test_artifact_roundtrip_and_session_cleanup(tmp_path: Path) -> None:
    store = ArtifactStore(tmp_path)
    ref = store.add_bytes(
        b"hello", kind="test", mime_type="text/plain", session_id="session-1"
    )

    assert store.get(ref.artifact_id).path.read_bytes() == b"hello"
    assert ref.sha256 == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"

    store.delete_session("session-1")

    with pytest.raises(NotFoundError):
        store.get(ref.artifact_id)


def test_artifact_size_limit(tmp_path: Path) -> None:
    store = ArtifactStore(tmp_path)

    with pytest.raises(InvalidArgumentError):
        store.add_bytes(b"x" * (MAX_ARTIFACT_BYTES + 1), kind="oversized")
