import { message } from "antd";

import type {
  DocumentOpenResult,
  DocumentSaveResult,
  WorkspaceDocumentsPayload,
} from "../generated/bridge-v2";
import type { LocalWebSocketServer } from "../server";
import { useDocumentStore } from "../../stores/documentStore";
import { useLocalFileStore } from "../../stores/localFileStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import { BaseProtocol } from "./BaseProtocol";

export class DocumentProtocol extends BaseProtocol {
  private readonly savingPaths = new Set<string>();

  getName(): string {
    return "DocumentProtocol";
  }

  getVersion(): string {
    return "1.0.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;
    wsClient.registerRoute("workspace.documents", (data) =>
      this.handleDocuments(data),
    );
    wsClient.registerRoute("file.changed", (data) => this.handleFileChanged(data));
  }

  protected handleMessage(_path: string, _data: unknown): void {}

  async openDocument(path: string): Promise<boolean> {
    const store = useDocumentStore.getState();
    const descriptor = store.documents[path];
    if (!descriptor || descriptor.kind === "pipeline") return false;

    useProjectSessionStore.getState().openDocument(path);
    const existing = store.opened[path];
    if (existing && !existing.loading && !existing.error && !existing.deleted) {
      return true;
    }
    if (!store.beginOpen(path)) return false;

    try {
      const result = await this.requestOpen(path);
      const imageUrl = await this.cacheProjectImage(result);
      useDocumentStore.getState().finishOpen(result, imageUrl);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      useDocumentStore.getState().failOpen(path, errorMessage);
      message.error(`文件打开失败: ${errorMessage}`);
      return false;
    }
  }

  async saveDocument(path: string): Promise<boolean> {
    const client = this.wsClient;
    const document = useDocumentStore.getState().opened[path];
    if (
      !client ||
      !document ||
      !document.descriptor.editable ||
      !document.baseRevision ||
      !document.dirty
    ) {
      return false;
    }

    this.savingPaths.add(path);
    try {
      const result = await client.request<DocumentSaveResult>("document.save", {
        path,
        content: document.content,
        base_revision: document.baseRevision,
      });
      useDocumentStore.getState().markSaved(path, result.revision);
      message.success(`已保存 ${document.descriptor.name}`);
      return true;
    } catch (error) {
      if (isRecord(error) && error.code === "document_conflict") {
        await this.refreshFromExternal(path);
        message.warning("文件已被外部修改，请选择要保留的版本");
      } else {
        message.error(error instanceof Error ? error.message : "文档保存失败");
      }
      return false;
    } finally {
      this.savingPaths.delete(path);
    }
  }

  async reloadExternal(path: string): Promise<boolean> {
    try {
      const result = await this.requestOpen(path);
      const imageUrl = await this.cacheProjectImage(result);
      useDocumentStore.getState().reloadExternal(path, result, imageUrl);
      return true;
    } catch (error) {
      useDocumentStore
        .getState()
        .failOpen(path, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private handleDocuments(data: unknown): void {
    if (!isWorkspaceDocuments(data)) {
      console.error("[DocumentProtocol] Invalid workspace documents:", data);
      return;
    }
    useDocumentStore.getState().applyDocuments(data);
  }

  private handleFileChanged(data: unknown): void {
    if (!isFileChanged(data) || data.is_directory) return;
    const opened = useDocumentStore.getState().opened[data.file_path];
    if (!opened) return;
    if (data.type === "modified") {
      if (!this.savingPaths.has(data.file_path)) {
        void this.refreshFromExternal(data.file_path);
      }
      return;
    }
    if (data.type === "deleted" || data.type === "renamed") {
      useDocumentStore.getState().markDeleted(data.file_path);
    }
  }

  private async refreshFromExternal(path: string): Promise<void> {
    try {
      const external = await this.requestOpen(path);
      const imageUrl = await this.cacheProjectImage(external);
      const document = useDocumentStore.getState().opened[path];
      if (!document) return;
      if (document.dirty) {
        useDocumentStore.getState().setConflict(path, external);
      } else {
        useDocumentStore.getState().reloadExternal(path, external, imageUrl);
      }
    } catch (error) {
      useDocumentStore
        .getState()
        .failOpen(path, error instanceof Error ? error.message : String(error));
    }
  }

  private requestOpen(path: string): Promise<DocumentOpenResult> {
    if (!this.wsClient) return Promise.reject(new Error("LocalBridge 未连接"));
    return this.wsClient.request<DocumentOpenResult>("document.open", { path });
  }

  private async cacheProjectImage(
    result: DocumentOpenResult,
  ): Promise<string | undefined> {
    if (result.kind !== "image" || !result.artifact || !this.wsClient) {
      return undefined;
    }
    const imageUrl = await this.wsClient.getArtifactUrl(result.artifact);
    useLocalFileStore.getState().setImageCache(result.path, {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isWorkspaceDocuments(
  value: unknown,
): value is WorkspaceDocumentsPayload {
  if (
    !isRecord(value) ||
    typeof value.revision !== "number" ||
    typeof value.root !== "string" ||
    !Array.isArray(value.documents)
  ) {
    return false;
  }
  return value.documents.every(
    (document) =>
      isRecord(document) &&
      typeof document.path === "string" &&
      typeof document.name === "string" &&
      typeof document.kind === "string" &&
      typeof document.mimeType === "string" &&
      typeof document.size === "number" &&
      typeof document.editable === "boolean" &&
      typeof document.previewable === "boolean",
  );
}

function isFileChanged(
  value: unknown,
): value is { type: string; file_path: string; is_directory?: boolean } {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    typeof value.file_path === "string"
  );
}
