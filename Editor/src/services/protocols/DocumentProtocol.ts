import { message } from "antd";

import type { DocumentOpenResult, WorkspaceDocument } from "../generated/bridge-v2";
import type { LocalWebSocketServer } from "../server";
import { projectStorageCoordinator } from "../../features/project-storage/projectStorageCoordinator";
import type { DocumentId, ProjectEntry } from "../../features/project-session/types";
import { useDocumentStore } from "../../stores/documentStore";
import { useResourceStore } from "../../stores/resourceStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import { BaseProtocol } from "./BaseProtocol";

export class DocumentProtocol extends BaseProtocol {
  private readonly savingIds = new Set<DocumentId>();

  getName(): string {
    return "DocumentProtocol";
  }

  getVersion(): string {
    return "2.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;
  }

  protected handleMessage(): void {}

  async openDocument(documentId: DocumentId): Promise<boolean> {
    const session = useProjectSessionStore.getState();
    const entry = session.entriesById[documentId];
    if (!entry || entry.path === undefined || entry.entryKind !== "file" || entry.kind === "pipeline") {
      return false;
    }
    session.openDocument(documentId);
    const existing = useDocumentStore.getState().opened[documentId];
    if (existing && !existing.loading && !existing.error && !existing.deleted) {
      return true;
    }
    const descriptor = descriptorFromEntry(entry);
    if (!useDocumentStore.getState().beginOpen(documentId, descriptor)) return false;

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

  async saveDocument(documentId: DocumentId): Promise<boolean> {
    const document = useDocumentStore.getState().opened[documentId];
    if (
      !document ||
      !document.descriptor.editable ||
      !document.baseRevision ||
      !document.dirty ||
      document.deleted
    ) {
      return false;
    }

    this.savingIds.add(documentId);
    const savedContent = document.content;
    try {
      const result = await projectStorageCoordinator
        .requireAdapter()
        .write(documentId, savedContent, document.baseRevision);
      useDocumentStore
        .getState()
        .markSaved(documentId, result.revision, savedContent);
      message.success(`已保存 ${document.descriptor.name}`);
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : "文档保存失败");
      return false;
    } finally {
      this.savingIds.delete(documentId);
    }
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

  async refreshFromExternal(documentId: DocumentId): Promise<void> {
    if (this.savingIds.has(documentId)) return;
    try {
      const external = await projectStorageCoordinator.requireAdapter().read(documentId);
      const imageUrl = await this.cacheProjectImage(external);
      const document = useDocumentStore.getState().opened[documentId];
      if (!document) return;
      if (document.dirty) {
        useDocumentStore.getState().setConflict(documentId, external);
      } else {
        useDocumentStore
          .getState()
          .reloadExternal(documentId, external, imageUrl);
      }
    } catch (error) {
      useDocumentStore
        .getState()
        .failOpen(documentId, error instanceof Error ? error.message : String(error));
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
