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


class ProjectCapability(ApiModel):
    available: bool
    reason: str | None = None


class ProjectStorageCapabilities(ApiModel):
    project_id: str | None = None
    path_case_sensitive: bool
    operations: dict[str, ProjectCapability]


class ProjectDiscoveryCandidate(ApiModel):
    candidate_id: str
    interface_path: str
    name: str
    label: str
    version: str


class ProjectDiscoveryStatus(ApiModel):
    revision: int
    discovery_root: str
    state: Literal["discovering", "selection_required", "indexing", "ready", "invalid"]
    reason: str
    candidates: list[ProjectDiscoveryCandidate]
    current_interface: ProjectDiscoveryCandidate | None = None
    indexed_files: int
    total_files: int
    diagnostics: list[dict[str, Any]]


class ProjectStatus(ApiModel):
    revision: int
    available: bool
    project_id: str | None = None
    project_root: str | None = None
    interface_path: str | None = None
    name: str | None = None
    label: str | None = None
    version: str | None = None
    state: Literal["discovering", "selection_required", "indexing", "ready", "invalid"]
    indexed_files: int
    total_files: int


class ProjectPipelineIndex(ApiModel):
    nodes: list[dict[str, Any]]
    prefix: str
    index_status: Literal["pending", "ready", "error"]
    is_default_pipeline: bool


class ProjectEntry(ApiModel):
    path: str
    name: str
    entry_kind: Literal["directory", "file"]
    document_id: str | None = None
    kind: Literal[
        "pipeline", "interface", "json", "text", "markdown", "image", "binary"
    ] | None = None
    language: str = ""
    mime_type: str = "application/octet-stream"
    size: int = 0
    editable: bool = False
    previewable: bool = True
    read_only_reason: str | None = None
    role: Literal["default_pipeline", "mpe_config"] | None = None
    pipeline: ProjectPipelineIndex | None = None


class ProjectEntriesPayload(ApiModel):
    revision: int
    project_id: str | None = None
    entries: list[ProjectEntry]


class DocumentMapping(ApiModel):
    old_path: str
    new_path: str
    old_document_id: str
    new_document_id: str


class ProjectChangedPayload(ApiModel):
    project_id: str
    operation_id: str
    change: Literal["created", "modified", "deleted", "renamed"]
    path: str
    new_path: str | None = None
    is_directory: bool = False
    document_mappings: list[DocumentMapping] = Field(
        default_factory=lambda: list[DocumentMapping]()
    )


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
    encoding: Literal["utf-8", "utf-8-bom"] | None = None
    revision: str
    artifact: ArtifactRef | None = None


class DocumentSaveResult(ApiModel):
    path: str
    revision: str
    size: int
    sha256: str
    operation_id: str
    encoding: Literal["utf-8", "utf-8-bom"]


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
