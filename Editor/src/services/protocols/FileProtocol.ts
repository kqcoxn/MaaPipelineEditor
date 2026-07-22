import { projectStorageCoordinator } from "../../features/project-storage/projectStorageCoordinator";
import { reloadPipelineProjection } from "../../features/pipeline-document/pipelineDocumentService";
import type { DocumentId } from "../../features/project-session/types";
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
import { documentProtocol, type LocalWebSocketServer } from "../server";
import { BaseProtocol } from "./BaseProtocol";

export class FileProtocol extends BaseProtocol {
  getName(): string {
    return "FileProtocol";
  }

  getVersion(): string {
    return "2.5.0";
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
    wsClient.registerRoute("project.changed", (data) =>
      void this.handleProjectChanged(data),
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

  private async handleProjectChanged(data: unknown): Promise<void> {
    if (!isProjectChanged(data)) return;
    const session = useProjectSessionStore.getState();
    if (session.identity?.projectId !== data.projectId) return;

    if (data.documentMappings.length > 0) {
      session.applyDocumentMappings(data.documentMappings);
      useDocumentStore.getState().applyDocumentMappings(data.documentMappings);
      useFileStore.getState().applyDocumentIdMappings(data.documentMappings);
      if (data.change === "renamed" && data.newPath) {
        useFileStore.getState().renamePath(data.path, data.newPath, data.isDirectory);
      }
    }

    const documentId = session.documentIdByPath[data.path];
    if (data.change === "modified" && documentId) {
      await documentProtocol.refreshFromExternal(documentId, data.operationId);
      await this.refreshActivePipelineProjection(documentId);
    } else if (data.change === "deleted" && documentId) {
      useDocumentStore.getState().markDeleted(documentId);
    }
    if (data.change !== "modified") await this.refreshEntries();
  }

  private async refreshActivePipelineProjection(changedId: DocumentId): Promise<void> {
    const session = useProjectSessionStore.getState();
    const opened = useDocumentStore.getState().opened;
    const primaryId = Object.values(opened).find(
      (document) =>
        document.descriptor.kind === "pipeline" &&
        (document.documentId === changedId ||
          document.linkedDocumentIds.includes(changedId)),
    )?.documentId;
    if (primaryId && session.activeDocumentId === primaryId) {
      await reloadPipelineProjection(primaryId);
    }
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProjectDiscovery(value: unknown): value is ProjectDiscoveryStatus {
  return (
    isRecord(value) &&
    typeof value.revision === "number" &&
    typeof value.discoveryRoot === "string" &&
    Array.isArray(value.candidates)
  );
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    isRecord(value) &&
    typeof value.revision === "number" &&
    typeof value.available === "boolean" &&
    typeof value.state === "string"
  );
}

function isProjectCapabilities(value: unknown): value is ProjectStorageCapabilities {
  return (
    isRecord(value) &&
    typeof value.pathCaseSensitive === "boolean" &&
    isRecord(value.operations)
  );
}

function isProjectEntries(value: unknown): value is ProjectEntriesPayload {
  return (
    isRecord(value) &&
    typeof value.revision === "number" &&
    Array.isArray(value.entries)
  );
}

function isProjectChanged(value: unknown): value is ProjectChangedPayload {
  return (
    isRecord(value) &&
    typeof value.projectId === "string" &&
    typeof value.operationId === "string" &&
    typeof value.change === "string" &&
    typeof value.path === "string" &&
    typeof value.isDirectory === "boolean" &&
    Array.isArray(value.documentMappings)
  );
}
