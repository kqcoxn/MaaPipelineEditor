from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class RpcRequest(ApiModel):
    v: Literal[2]
    type: Literal["request"]
    id: str = Field(min_length=1, max_length=128)
    method: str = Field(pattern=r"^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$")
    params: dict[str, Any] = Field(default_factory=dict)


class RpcError(ApiModel):
    code: str
    message: str
    data: dict[str, Any] | None = None


class RpcResponse(ApiModel):
    v: Literal[2] = 2
    type: Literal["response"] = "response"
    id: str
    result: Any | None = None
    error: RpcError | None = None


class RpcEvent(ApiModel):
    v: Literal[2] = 2
    type: Literal["event"] = "event"
    event: str
    data: Any


class WorkspaceTreeEntry(ApiModel):
    path: str
    name: str
    kind: Literal["directory", "file"]


class WorkspaceTreePayload(ApiModel):
    revision: int
    root: str
    entries: list[WorkspaceTreeEntry]


class WorkspaceDocument(ApiModel):
    path: str
    name: str
    kind: Literal[
        "pipeline",
        "interface",
        "json",
        "text",
        "markdown",
        "image",
        "binary",
    ]
    language: str = ""
    mime_type: str = "application/octet-stream"
    size: int = 0
    editable: bool = False
    previewable: bool = True
    read_only_reason: str | None = None
    role: Literal["default_pipeline", "mpe_config"] | None = None


class WorkspaceDocumentsPayload(ApiModel):
    revision: int
    root: str
    documents: list[WorkspaceDocument]


class HelloParams(ApiModel):
    protocol_version: str
    client_version: str
    client_kind: Literal["web", "desktop", "test"] = "web"
    after_seq: dict[str, int] = Field(default_factory=dict)


class ArtifactRef(ApiModel):
    artifact_id: str
    kind: str
    mime_type: str
    size: int
    sha256: str
    width: int | None = None
    height: int | None = None
    session_id: str | None = None
    run_id: str | None = None
    created_at: datetime


class DocumentOpenResult(WorkspaceDocument):
    content: str | None = None
    encoding: Literal["utf-8"] | None = None
    revision: str
    artifact: ArtifactRef | None = None


class DocumentSaveResult(ApiModel):
    path: str
    revision: str
    size: int
    sha256: str


class DebugEvent(ApiModel):
    session_id: str
    run_id: str | None = None
    seq: int = 0
    timestamp: datetime = Field(default_factory=lambda: datetime.now().astimezone())
    source: Literal["maafw", "localbridge", "mpe"]
    kind: str
    phase: str
    status: str
    payload: dict[str, Any] = Field(default_factory=dict)
    artifact_refs: list[ArtifactRef] = Field(default_factory=lambda: list[ArtifactRef]())
    parent_seq: int | None = None
