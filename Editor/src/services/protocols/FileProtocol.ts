import { Button, message, Modal, Space } from "antd";
import { createElement } from "react";

import { projectStorageCoordinator } from "../../features/project-storage/projectStorageCoordinator";
import type { DocumentId } from "../../features/project-session/types";
import { useConfigStore } from "../../stores/configStore";
import { useDocumentStore } from "../../stores/documentStore";
import { useFileStore } from "../../stores/fileStore";
import { useProjectSessionStore } from "../../stores/projectSessionStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import type {
  ProjectChangedPayload,
  ProjectDiscoveryStatus,
  ProjectEntriesPayload,
  ProjectStatus,
  ProjectStorageCapabilities,
} from "../generated/bridge-v2";
import type { LocalWebSocketServer } from "../server";
import { BaseProtocol } from "./BaseProtocol";

export class FileProtocol extends BaseProtocol {
  private currentModal: ReturnType<typeof Modal.confirm> | null = null;
  private pendingModifiedFiles = new Map<string, string>();

  private static pendingSaveCallbacks = new Map<
    string,
    {
      resolve: (success: boolean) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  private static readonly SAVE_ACK_TIMEOUT = 10000;

  getName(): string {
    return "FileProtocol";
  }

  getVersion(): string {
    return "2.4.0";
  }

  register(wsClient: LocalWebSocketServer): void {
    this.wsClient = wsClient;
    wsClient.registerRoute("project.discovery", (data) => this.handleDiscovery(data));
    wsClient.registerRoute("project.status", (data) => this.handleProjectStatus(data));
    wsClient.registerRoute("project.capabilities", (data) =>
      this.handleCapabilities(data),
    );
    wsClient.registerRoute("project.entries", (data) => this.handleEntries(data));
    wsClient.registerRoute("project.indexUpdated", () => void this.refreshEntries());
    wsClient.registerRoute("project.changed", (data) => this.handleProjectChanged(data));
    wsClient.registerRoute("file.content", (data) => void this.handleFileContent(data));
    wsClient.registerRoute("file.saved", (data) => this.handleSaveAck(data));
    wsClient.registerRoute("file.separatedSaved", (data) =>
      this.handleSaveSeparatedAck(data),
    );
  }

  protected handleMessage(): void {}

  private handleDiscovery(data: unknown): void {
    if (!isProjectDiscovery(data)) {
      console.error("[FileProtocol] Invalid project.discovery payload", data);
      return;
    }
    useWorkspaceStore.getState().applyDiscovery(data);
  }

  private handleProjectStatus(data: unknown): void {
    if (!isProjectStatus(data)) {
      console.error("[FileProtocol] Invalid project.status payload", data);
      return;
    }
    projectStorageCoordinator.updateLocalBridgeIdentity(data);
    useProjectSessionStore
      .getState()
      .setAvailability(data.available ? "ready" : "unavailable", data.available);
  }

  private handleCapabilities(data: unknown): void {
    if (!isProjectCapabilities(data)) {
      console.error("[FileProtocol] Invalid project.capabilities payload", data);
      return;
    }
    useProjectSessionStore.getState().setCapabilities(data);
  }

  private handleEntries(data: unknown): void {
    if (!isProjectEntries(data)) {
      console.error("[FileProtocol] Invalid project.entries payload", data);
      return;
    }
    useProjectSessionStore.getState().applyEntries(data);
  }

  private async refreshEntries(): Promise<void> {
    const adapter = projectStorageCoordinator.getAdapter();
    if (!adapter) return;
    try {
      this.handleEntries(await adapter.list());
    } catch (error) {
      console.error("[FileProtocol] Failed to refresh project entries", error);
    }
  }

  private async handleFileContent(data: unknown): Promise<void> {
    if (!isRecord(data) || typeof data.file_path !== "string" || !("content" in data)) {
      console.error("[FileProtocol] Invalid file.content payload", data);
      return;
    }
    const session = useProjectSessionStore.getState();
    const documentId = session.documentIdByPath[data.file_path];
    if (!documentId) {
      message.error("打开的 Pipeline 不属于当前项目索引");
      return;
    }
    const success = await useFileStore.getState().openFileFromLocal(
      data.file_path,
      data.content,
      data.mpe_config,
      typeof data.config_path === "string" ? data.config_path : undefined,
      documentId,
    );
    if (success) session.openDocument(documentId);
    else message.error("Pipeline 打开失败");
  }

  private handleProjectChanged(data: unknown): void {
    if (!isProjectChanged(data)) return;
    const session = useProjectSessionStore.getState();
    if (session.identity?.projectId !== data.projectId) return;
    if (data.documentMappings.length) {
      session.applyDocumentMappings(data.documentMappings);
      useDocumentStore.getState().applyDocumentMappings(data.documentMappings);
      useFileStore.getState().applyDocumentIdMappings(data.documentMappings);
      if (data.change === "renamed" && data.newPath) {
        useFileStore.getState().renamePath(data.path, data.newPath, data.isDirectory);
      }
    }

    const documentId = session.documentIdByPath[data.path];
    if (data.change === "modified" && documentId) {
      const pipeline = useFileStore.getState().findFileByDocumentId(documentId);
      if (pipeline) {
        useFileStore.getState().markFileModified(data.path);
        this.showFileChangedNotification(documentId, data.path);
      } else if (useDocumentStore.getState().opened[documentId]) {
        void this.refreshOrdinaryDocument(documentId);
      }
    } else if (data.change === "deleted") {
      if (documentId) {
        useFileStore.getState().markFileDeleted(data.path);
        useDocumentStore.getState().markDeleted(documentId);
      }
    }
    if (data.change !== "modified") void this.refreshEntries();
  }

  private async refreshOrdinaryDocument(documentId: DocumentId): Promise<void> {
    const document = useDocumentStore.getState().opened[documentId];
    if (!document) return;
    try {
      const external = await projectStorageCoordinator.requireAdapter().read(documentId);
      if (document.dirty) useDocumentStore.getState().setConflict(documentId, external);
      else useDocumentStore.getState().reloadExternal(documentId, external);
    } catch (error) {
      useDocumentStore
        .getState()
        .failOpen(documentId, error instanceof Error ? error.message : String(error));
    }
  }

  public requestOpenFile(filePath: string): boolean {
    const documentId = useProjectSessionStore.getState().documentIdByPath[filePath];
    if (!documentId || !this.wsClient) return false;
    const entry = useProjectSessionStore.getState().entriesById[documentId];
    if (entry?.kind !== "pipeline") return false;
    return this.wsClient.send("file.open", { file_path: filePath });
  }

  public async requestCreateFile(fileName: string, directory: string): Promise<string | null> {
    const result = await projectStorageCoordinator.requireAdapter().create(directory, fileName);
    await this.refreshEntries();
    return result.path;
  }

  public async requestRenameEntry(entryPath: string, entryName: string): Promise<string | null> {
    const documentId = useProjectSessionStore.getState().documentIdByPath[entryPath];
    const result = await projectStorageCoordinator
      .requireAdapter()
      .rename({ path: entryPath, documentId }, entryName);
    return result.newPath;
  }

  public async requestDeleteFile(filePath: string): Promise<boolean> {
    const documentId = useProjectSessionStore.getState().documentIdByPath[filePath];
    await projectStorageCoordinator
      .requireAdapter()
      .delete({ path: filePath, documentId });
    return true;
  }

  public requestSaveSeparated(
    pipelinePath: string,
    configPath: string,
    pipeline: unknown,
    config: unknown,
  ): boolean {
    return Boolean(
      this.wsClient?.send("file.saveSeparated", {
        pipeline_path: pipelinePath,
        config_path: configPath,
        pipeline,
        config,
      }),
    );
  }

  private requestFileReload(filePath: string): void {
    this.currentModal?.destroy();
    this.currentModal = null;
    if (!this.requestOpenFile(filePath)) message.error("重新加载请求发送失败");
  }

  private showFileChangedNotification(documentId: DocumentId, filePath: string): void {
    const file = useFileStore.getState().findFileByDocumentId(documentId);
    if (useConfigStore.getState().configs.fileAutoReload && !file?.saveState.dirty) {
      this.requestFileReload(filePath);
      return;
    }
    this.pendingModifiedFiles.set(filePath, file?.fileName ?? filePath);
    if (this.currentModal) return;
    const dirty = Boolean(file?.saveState.dirty);
    this.currentModal = Modal.confirm({
      title: dirty ? "文件修改冲突" : "文件已被外部修改",
      content: dirty
        ? "本地草稿已保留。重新加载会放弃本地修改。"
        : "是否重新加载磁盘版本？",
      icon: null,
      closable: true,
      mask: { closable: false },
      footer: createElement(
        Space,
        { style: { display: "flex", justifyContent: "flex-end", marginTop: 16 } },
        createElement(
          Button,
          { onClick: () => this.dismissChangeModal() },
          dirty ? "保留本地修改" : "稍后处理",
        ),
        createElement(
          Button,
          {
            danger: dirty,
            type: dirty ? "default" : "primary",
            onClick: () => {
              this.pendingModifiedFiles.delete(filePath);
              this.requestFileReload(filePath);
            },
          },
          dirty ? "重新加载并放弃本地修改" : "重新加载",
        ),
      ),
      onCancel: () => {
        this.currentModal = null;
      },
    });
  }

  private dismissChangeModal(): void {
    this.pendingModifiedFiles.clear();
    this.currentModal?.destroy();
    this.currentModal = null;
  }

  private handleSaveAck(data: unknown): void {
    if (!isRecord(data) || typeof data.file_path !== "string") return;
    const success = data.status === "ok";
    FileProtocol.resolveSaveCallback(data.file_path, success);
    if (success) message.success(`文件已保存: ${data.file_path.split("/").at(-1)}`);
  }

  private handleSaveSeparatedAck(data: unknown): void {
    if (!isRecord(data) || typeof data.pipeline_path !== "string") return;
    const success = data.status === "ok";
    FileProtocol.resolveSaveCallback(data.pipeline_path, success);
    if (success) message.success(`文件已保存: ${data.pipeline_path.split("/").at(-1)}`);
  }

  static waitForSaveAck(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        FileProtocol.pendingSaveCallbacks.delete(filePath);
        resolve(false);
      }, FileProtocol.SAVE_ACK_TIMEOUT);
      FileProtocol.pendingSaveCallbacks.set(filePath, { resolve, timeout });
    });
  }

  private static resolveSaveCallback(filePath: string, success: boolean): void {
    const callback = FileProtocol.pendingSaveCallbacks.get(filePath);
    if (!callback) return;
    clearTimeout(callback.timeout);
    FileProtocol.pendingSaveCallbacks.delete(filePath);
    callback.resolve(success);
  }

  static clearAllPendingCallbacks(): void {
    FileProtocol.pendingSaveCallbacks.forEach((callback) => {
      clearTimeout(callback.timeout);
      callback.resolve(false);
    });
    FileProtocol.pendingSaveCallbacks.clear();
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProjectDiscovery(value: unknown): value is ProjectDiscoveryStatus {
  return isRecord(value) && typeof value.revision === "number" && typeof value.discoveryRoot === "string" && Array.isArray(value.candidates);
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return isRecord(value) && typeof value.revision === "number" && typeof value.available === "boolean" && typeof value.state === "string";
}

function isProjectCapabilities(value: unknown): value is ProjectStorageCapabilities {
  return isRecord(value) && typeof value.pathCaseSensitive === "boolean" && isRecord(value.operations);
}

function isProjectEntries(value: unknown): value is ProjectEntriesPayload {
  return isRecord(value) && typeof value.revision === "number" && Array.isArray(value.entries);
}

function isProjectChanged(value: unknown): value is ProjectChangedPayload {
  return isRecord(value) && typeof value.projectId === "string" && typeof value.operationId === "string" && typeof value.change === "string" && typeof value.path === "string" && typeof value.isDirectory === "boolean" && Array.isArray(value.documentMappings);
}
