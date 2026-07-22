import { message } from "antd";

import type { DocumentOpenResult, WorkspaceDocument } from "../generated/bridge-v2";
import { BridgeRpcError, type LocalWebSocketServer } from "../server";
import type {
  DocumentSaveReason,
  WriteDocumentInput,
} from "../../features/project-storage/ProjectStorageAdapter";
import { projectStorageCoordinator } from "../../features/project-storage/projectStorageCoordinator";
import { parseProjectPath } from "../../features/project-session/projectPath";
import type { DocumentId, ProjectEntry } from "../../features/project-session/types";
import { useDocumentStore, type OpenDocument } from "../../stores/documentStore";
import { useResourceStore } from "../../stores/resourceStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import { BaseProtocol } from "./BaseProtocol";

export type DocumentSaveStatus = "saved" | "clean" | "failed";

export interface DocumentSaveOutcome {
  documentId: DocumentId;
  status: DocumentSaveStatus;
  name: string;
  error?: string;
}

export class DocumentProtocol extends BaseProtocol {
  private readonly pendingOperations = new Map<DocumentId, string>();

  getName(): string {
    return "DocumentProtocol";
  }

  getVersion(): string {
    return "2.1.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;
  }

  protected handleMessage(): void {}

  async openDocument(
    documentId: DocumentId,
    options: { activate?: boolean } = {},
  ): Promise<boolean> {
    const session = useProjectSessionStore.getState();
    const entry = session.entriesById[documentId];
    if (!entry || entry.path === undefined || entry.entryKind !== "file") return false;
    if (options.activate !== false) session.openDocument(documentId);

    const existing = useDocumentStore.getState().opened[documentId];
    if (existing && !existing.loading && !existing.error && !existing.deleted) {
      return true;
    }
    useDocumentStore.getState().beginOpen(documentId, descriptorFromEntry(entry));

    try {
      const result = await projectStorageCoordinator.requireAdapter().read(documentId);
      const imageUrl = await this.cacheProjectImage(result);
      useDocumentStore.getState().finishOpen(documentId, result, imageUrl);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      useDocumentStore.getState().failOpen(documentId, errorMessage);
      message.error(`文件打开失败: ${errorMessage}`);
      return false;
    }
  }

  async saveDocument(
    documentId: DocumentId,
    reason: DocumentSaveReason = "user",
  ): Promise<DocumentSaveOutcome> {
    let preparedId: DocumentId;
    try {
      preparedId = await this.materializeDraft(documentId);
    } catch (error) {
      return failedOutcome(
        documentId,
        error instanceof Error ? error.message : "文档创建失败",
      );
    }
    const document = useDocumentStore.getState().opened[preparedId];
    if (!document) return failedOutcome(preparedId, "文档未打开");
    if (!document.dirty) return outcome(document, "clean");
    if (!canSave(document)) return failedOutcome(preparedId, saveBlockedReason(document));

    const input: WriteDocumentInput = {
      documentId: preparedId,
      content: document.workingText,
      expectedRevision: document.savedRevision,
      encoding: document.encoding,
      operationId: crypto.randomUUID(),
      reason,
    };
    this.pendingOperations.set(preparedId, input.operationId);
    useDocumentStore.getState().setSaving(preparedId, true);

    try {
      const result = await projectStorageCoordinator.requireAdapter().write(input);
      useDocumentStore.getState().markSaved(preparedId, result, input.content);
      return outcome(
        useDocumentStore.getState().opened[preparedId] ?? document,
        "saved",
      );
    } catch (error) {
      await this.handleSaveFailure(preparedId, error);
      return failedOutcome(
        preparedId,
        error instanceof Error ? error.message : "文档保存失败",
      );
    } finally {
      if (this.pendingOperations.get(preparedId) === input.operationId) {
        this.pendingOperations.delete(preparedId);
      }
      useDocumentStore.getState().setSaving(preparedId, false);
    }
  }

  async saveDocuments(
    documentIds: DocumentId[],
    reason: DocumentSaveReason,
  ): Promise<DocumentSaveOutcome[]> {
    const uniqueIds = [...new Set(documentIds)];
    return Promise.all(uniqueIds.map((documentId) => this.saveDocument(documentId, reason)));
  }

  async saveDocumentGroup(
    documentId: DocumentId,
    reason: DocumentSaveReason = "user",
  ): Promise<DocumentSaveOutcome[]> {
    const document = useDocumentStore.getState().opened[documentId];
    const documentIds = [documentId, ...(document?.linkedDocumentIds ?? [])];
    return this.saveDocuments(documentIds, reason);
  }

  async saveAllDirty(
    reason: DocumentSaveReason = "save-all",
  ): Promise<DocumentSaveOutcome[]> {
    const documentIds = Object.values(useDocumentStore.getState().opened)
      .filter((document) => document.dirty)
      .map((document) => document.documentId);
    return this.saveDocuments(documentIds, reason);
  }

  async reloadExternal(documentId: DocumentId): Promise<boolean> {
    try {
      const result = await projectStorageCoordinator.requireAdapter().read(documentId);
      const imageUrl = await this.cacheProjectImage(result);
      useDocumentStore.getState().reloadExternal(documentId, result, imageUrl);
      return true;
    } catch (error) {
      useDocumentStore
        .getState()
        .failOpen(documentId, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async refreshFromExternal(documentId: DocumentId, operationId?: string): Promise<void> {
    if (operationId && this.pendingOperations.get(documentId) === operationId) return;
    try {
      const external = await projectStorageCoordinator.requireAdapter().read(documentId);
      const document = useDocumentStore.getState().opened[documentId];
      if (!document || external.revision === document.savedRevision) return;
      const imageUrl = await this.cacheProjectImage(external);
      if (document.dirty) {
        useDocumentStore.getState().setConflict(documentId, external);
      } else {
        useDocumentStore.getState().reloadExternal(documentId, external, imageUrl);
      }
    } catch (error) {
      useDocumentStore
        .getState()
        .failOpen(documentId, error instanceof Error ? error.message : String(error));
    }
  }

  private async materializeDraft(documentId: DocumentId): Promise<DocumentId> {
    const document = useDocumentStore.getState().opened[documentId];
    if (!document || document.savedRevision || !document.path) return documentId;
    const path = parseProjectPath(document.path);
    const segments = path.split("/");
    const name = segments.pop()!;
    const directory = segments.join("/");
    const adapter = projectStorageCoordinator.requireAdapter();
    const created = await adapter.create(directory, name);
    const entries = await adapter.list();
    useProjectSessionStore.getState().applyEntries(entries);

    const external = await adapter.read(created.documentId);
    const mapping = {
      oldPath: path,
      newPath: created.path,
      oldDocumentId: documentId,
      newDocumentId: created.documentId,
    };
    useDocumentStore.getState().applyDocumentMappings([mapping]);
    useDocumentStore.getState().reloadExternal(created.documentId, external);
    useDocumentStore.getState().updateWorkingText(created.documentId, document.workingText);
    return created.documentId;
  }

  private async handleSaveFailure(documentId: DocumentId, error: unknown): Promise<void> {
    useDocumentStore.getState().setSaving(documentId, false);
    const isConflict =
      error instanceof BridgeRpcError
        ? error.code === "document_conflict"
        : error instanceof Error && error.message.includes("外部修改");
    if (!isConflict) return;
    try {
      const external = await projectStorageCoordinator.requireAdapter().read(documentId);
      useDocumentStore.getState().setConflict(documentId, external);
    } catch {
      // Keep the local draft and surface the original save error.
    }
  }

  private async cacheProjectImage(
    result: DocumentOpenResult,
  ): Promise<string | undefined> {
    if (result.kind !== "image" || !result.artifact || !this.wsClient) {
      return undefined;
    }
    const imageUrl = await this.wsClient.getArtifactUrl(result.artifact);
    useResourceStore.getState().setImageCache(result.path, {
      base64: imageUrl,
      mimeType: result.artifact.mimeType,
      width: result.artifact.width ?? 0,
      height: result.artifact.height ?? 0,
      bundleName: "",
      absPath: result.path,
      timestamp: Date.now(),
    });
    return imageUrl;
  }
}

function canSave(document: OpenDocument): boolean {
  return Boolean(
    document.descriptor.editable &&
      document.savedRevision &&
      !document.deleted &&
      !document.conflict &&
      !document.saving,
  );
}

function saveBlockedReason(document: OpenDocument): string {
  if (!document.descriptor.editable) return "文档不可编辑";
  if (!document.savedRevision) return "文档尚未建立保存基线";
  if (document.deleted) return "文档已被删除";
  if (document.conflict) return "请先处理外部修改冲突";
  if (document.saving) return "文档正在保存";
  return "文档无法保存";
}

function outcome(
  document: OpenDocument,
  status: DocumentSaveStatus,
  error?: string,
): DocumentSaveOutcome {
  return {
    documentId: document.documentId,
    status,
    name: document.descriptor.name,
    error,
  };
}

function failedOutcome(documentId: DocumentId, error: string): DocumentSaveOutcome {
  const document = useDocumentStore.getState().opened[documentId];
  return {
    documentId,
    status: "failed",
    name: document?.descriptor.name ?? documentId,
    error,
  };
}

function descriptorFromEntry(entry: ProjectEntry): WorkspaceDocument {
  return {
    path: entry.path,
    name: entry.name,
    kind: entry.kind ?? "binary",
    language: entry.language ?? "",
    mimeType: entry.mimeType ?? "application/octet-stream",
    size: entry.size ?? 0,
    editable: entry.editable ?? false,
    previewable: entry.previewable ?? false,
    readOnlyReason: entry.readOnlyReason,
    role: entry.role,
  };
}
